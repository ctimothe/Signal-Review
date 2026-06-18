#!/usr/bin/env node

import { chmod, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = join(repoRoot, 'dist', 'macos');
const appBundle = join(distRoot, 'Signal Review.app');
const contentsDir = join(appBundle, 'Contents');
const macosDir = join(contentsDir, 'MacOS');
const resourcesDir = join(contentsDir, 'Resources');
const appResourcesDir = join(resourcesDir, 'app');
const appExecutable = join(macosDir, 'Signal Review');

const copyRuntime = async () => {
  await cp(join(repoRoot, 'src'), join(appResourcesDir, 'src'), { recursive: true });
  await cp(join(repoRoot, 'scripts'), join(appResourcesDir, 'scripts'), { recursive: true });
};

const buildLauncher = () => `#!/bin/bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_RESOURCES="$APP_DIR/Resources/app"
CONFIG_DIR="$HOME/Library/Application Support/Signal Review"
CONFIG_FILE="$CONFIG_DIR/config.json"

shell_quote() {
  printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"
}

prompt_value() {
  local prompt="$1"
  local default_value="$2"

  osascript <<OSA
text returned of (display dialog "$prompt" default answer "$default_value" buttons {"Continue"} default button "Continue" with title "Signal Review")
OSA
}

ensure_config() {
  if [[ -f "$CONFIG_FILE" ]]; then
    return
  fi

  mkdir -p "$CONFIG_DIR"

  local repo_root
  local base_url
  local model

  repo_root="$(osascript <<'OSA'
set chosenFolder to choose folder with prompt "Choose the repository to review"
POSIX path of chosenFolder
OSA
)"
  base_url="$(prompt_value "Backend base URL" "http://127.0.0.1:11434")"
  model="$(prompt_value "Backend model" "qwen2.5:14b")"

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

if ! command -v node >/dev/null 2>&1; then
  osascript -e 'display dialog "Signal Review needs Node.js 22+ to run. Install Node from https://nodejs.org/en/download/ or via Homebrew with: brew install node" buttons {"OK"} default button "OK" with title "Signal Review"'
  exit 1
fi

ensure_config

terminal_command="cd $(shell_quote "$APP_RESOURCES") && node scripts/review.js --config $(shell_quote "$CONFIG_FILE")"
osascript <<OSA
tell application "Terminal"
  activate
  do script "$terminal_command"
end tell
OSA
`;

const buildInfoPlist = (version) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>CFBundleDisplayName</key>
    <string>Signal Review</string>
    <key>CFBundleExecutable</key>
    <string>Signal Review</string>
    <key>CFBundleIdentifier</key>
    <string>com.ctimothe.signalreview</string>
    <key>CFBundleName</key>
    <string>Signal Review</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>${version}</string>
    <key>CFBundleVersion</key>
    <string>${version}</string>
    <key>LSMinimumSystemVersion</key>
    <string>13.0</string>
  </dict>
</plist>
`;

const main = async () => {
  const packageJson = JSON.parse(await readFile(join(repoRoot, 'package.json'), 'utf8'));

  await rm(distRoot, { recursive: true, force: true });
  await mkdir(appResourcesDir, { recursive: true });
  await mkdir(macosDir, { recursive: true });

  await copyRuntime();
  await writeFile(appExecutable, buildLauncher());
  await chmod(appExecutable, 0o755);
  await writeFile(join(contentsDir, 'Info.plist'), buildInfoPlist(packageJson.version));

  console.log(`Built macOS app bundle at ${appBundle}`);

  const dmgPath = join(repoRoot, 'dist', `Signal Review-${packageJson.version}-macos.dmg`);

  if (process.platform !== 'darwin' || !existsSync('/usr/bin/hdiutil')) {
    console.log('Skipping DMG creation on this platform.');
    console.log(`Run this script on macOS to produce ${dmgPath}.`);
    return;
  }

  await rm(dmgPath, { force: true });

  const { execFile } = await import('node:child_process');
  await new Promise((resolvePromise, rejectPromise) => {
    execFile(
      '/usr/bin/hdiutil',
      ['create', '-volname', 'Signal Review', '-srcfolder', distRoot, '-ov', '-format', 'UDZO', dmgPath],
      (error) => {
        if (error) {
          rejectPromise(error);
          return;
        }

        resolvePromise();
      }
    );
  });

  console.log(`Built DMG at ${dmgPath}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
