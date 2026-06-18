#!/usr/bin/env node

import { chmod, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = join(repoRoot, 'dist', 'linux');
const appDir = join(distRoot, 'Signal Review.AppDir');
const appResourcesDir = join(appDir, 'usr', 'lib', 'signal-review');
const appRunPath = join(appDir, 'AppRun');
const desktopPath = join(appDir, 'signal-review.desktop');
const iconPath = join(appDir, 'signal-review.svg');

const linuxAppRun = () => `#!/bin/bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_RESOURCES="$APP_DIR/usr/lib/signal-review"
CONFIG_DIR="$HOME/.config/signal-review"
CONFIG_FILE="$CONFIG_DIR/config.json"
REPORT_FILE="$(mktemp /tmp/signal-review-report.XXXXXX.txt)"

cleanup() {
  rm -f "$REPORT_FILE"
}

trap cleanup EXIT

require_node() {
  if command -v node >/dev/null 2>&1; then
    return
  fi

  if command -v zenity >/dev/null 2>&1; then
    zenity --error --title="Signal Review" --text="Signal Review needs Node.js 22+ to run."
  else
    printf '%s\n' "Signal Review needs Node.js 22+ to run." >&2
  fi

  exit 1
}

prompt_text() {
  local prompt="$1"
  local default_value="$2"

  if command -v zenity >/dev/null 2>&1; then
    zenity --entry --title="Signal Review" --text="$prompt" --entry-text="$default_value"
    return
  fi

  printf '%s [%s]: ' "$prompt" "$default_value" >&2
  read -r value
  if [[ -n "$value" ]]; then
    printf '%s' "$value"
  else
    printf '%s' "$default_value"
  fi
}

prompt_directory() {
  local default_value="$1"

  if command -v zenity >/dev/null 2>&1; then
    zenity --file-selection --directory --title="Signal Review" --filename="$default_value"
    return
  fi

  printf '%s [%s]: ' "Repository path" "$default_value" >&2
  read -r value
  if [[ -n "$value" ]]; then
    printf '%s' "$value"
  else
    printf '%s' "$default_value"
  fi
}

ensure_config() {
  if [[ -f "$CONFIG_FILE" ]]; then
    return
  fi

  mkdir -p "$CONFIG_DIR"

  local repo_root
  local base_url
  local model

  repo_root="$(prompt_directory "$(pwd)")"
  base_url="$(prompt_text "Backend base URL" "http://127.0.0.1:11434")"
  model="$(prompt_text "Backend model" "qwen2.5:14b")"

  node --input-type=module - "$CONFIG_FILE" "$repo_root" "$base_url" "$model" <<'NODE'
const [configPath, repoRoot, baseUrl, model] = process.argv.slice(2);

const { dirname } = await import('node:path');
const { mkdir, writeFile } = await import('node:fs/promises');

await mkdir(dirname(configPath), { recursive: true });
await writeFile(
  configPath,
  JSON.stringify(
    {
      repoRoot,
      baseUrl,
      model,
    },
    null,
    2
  )
);
NODE
}

show_report() {
  local status="$1"

  if command -v zenity >/dev/null 2>&1; then
    zenity --text-info --title="Signal Review" --filename="$REPORT_FILE" --width=900 --height=700
    return
  fi

  cat "$REPORT_FILE"
}

require_node
ensure_config

set +e
node "$APP_RESOURCES/scripts/review.js" --config "$CONFIG_FILE" >"$REPORT_FILE" 2>&1
status="$?"
set -e

show_report "$status"
exit "$status"
`;

const desktopFile = () => `[Desktop Entry]
Name=Signal Review
Comment=Run a local code review
Exec=AppRun
Icon=signal-review
Type=Application
Categories=Development;Utility;
Terminal=false
`;

const iconSvg = () => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0f172a"/>
  <circle cx="176" cy="192" r="72" fill="#38bdf8"/>
  <circle cx="336" cy="192" r="72" fill="#22c55e"/>
  <path d="M128 320c32-40 72-64 128-64s96 24 128 64" fill="none" stroke="#e2e8f0" stroke-width="28" stroke-linecap="round"/>
  <text x="256" y="404" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="76" font-weight="700" fill="#e2e8f0">SR</text>
</svg>
`;

const copyRuntime = async () => {
  await cp(join(repoRoot, 'src'), join(appResourcesDir, 'src'), { recursive: true });
  await cp(join(repoRoot, 'scripts'), join(appResourcesDir, 'scripts'), { recursive: true });
};

const createAppImage = async (version) => {
  const appImageTool = existsSync('/usr/bin/appimagetool') ? '/usr/bin/appimagetool' : null;

  if (!appImageTool) {
    return null;
  }

  const arch = process.arch === 'arm64' ? 'aarch64' : 'x86_64';
  const outputPath = join(repoRoot, 'dist', `Signal Review-${version}-${arch}.AppImage`);

  await rm(outputPath, { force: true });

  await new Promise((resolvePromise, rejectPromise) => {
    execFile(
      appImageTool,
      [appDir, outputPath],
      { env: { ...process.env, ARCH: arch } },
      (error) => {
        if (error) {
          rejectPromise(error);
          return;
        }

        resolvePromise();
      }
    );
  });

  return outputPath;
};

const main = async () => {
  const packageJson = JSON.parse(await readFile(join(repoRoot, 'package.json'), 'utf8'));

  await rm(appDir, { recursive: true, force: true });
  await mkdir(appResourcesDir, { recursive: true });

  await copyRuntime();
  await writeFile(appRunPath, linuxAppRun());
  await chmod(appRunPath, 0o755);
  await writeFile(desktopPath, desktopFile());
  await writeFile(iconPath, iconSvg());

  console.log(`Built Linux app directory at ${appDir}`);

  const appImagePath = await createAppImage(packageJson.version);

  if (appImagePath) {
    console.log(`Built AppImage at ${appImagePath}`);
  } else {
    console.log('appimagetool not found; skipped AppImage creation.');
    console.log(`You can run the AppDir directly with: ${appRunPath}`);
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
