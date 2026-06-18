import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { createOpenAICompatibleBackend } from './backendAdapter.js';
import { collectReviewContext } from './contextCollector.js';
import { runReview } from './reviewEngine.js';

export const DEFAULT_REVIEW_CONFIG_PATH =
  process.platform === 'darwin'
    ? join(homedir(), 'Library', 'Application Support', 'Signal Review', 'config.json')
    : join(homedir(), '.config', 'signal-review', 'config.json');

const parseArgs = (argv) => {
  const args = {
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    switch (value) {
      case '--json':
        args.json = true;
        break;
      case '--repo-root':
        args.repoRoot = argv[index + 1];
        index += 1;
        break;
      case '--config':
        args.config = argv[index + 1];
        index += 1;
        break;
      case '--base-url':
        args.baseUrl = argv[index + 1];
        index += 1;
        break;
      case '--model':
        args.model = argv[index + 1];
        index += 1;
        break;
      case '--api-key':
        args.apiKey = argv[index + 1];
        index += 1;
        break;
      case '--timeout-ms':
        args.timeoutMs = Number(argv[index + 1]);
        index += 1;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        break;
    }
  }

  return args;
};

const buildUsage = () =>
  [
    'Usage: node scripts/review.js [options]',
    '',
    'Options:',
    '  --repo-root <path>   Repository root to review (defaults to current working directory)',
    '  --config <path>      Review config file (defaults to the native app config location)',
    '  --base-url <url>     OpenAI-compatible backend base URL',
    '  --model <name>       Backend model name',
    '  --api-key <value>    Backend API key',
    '  --timeout-ms <n>     Backend timeout in milliseconds',
    '  --json               Print the full report as JSON',
    '  --help               Show this message',
  ].join('\n');

const formatFinding = (finding) => {
  const location = finding.file
    ? `${finding.file}${finding.line ? `:${finding.line}` : ''}`
    : 'unknown location';

  return [
    `- [${finding.severity}] ${finding.title} (${location})`,
    finding.message ? `  ${finding.message}` : null,
    finding.recommendation ? `  Fix: ${finding.recommendation}` : null,
  ]
    .filter(Boolean)
    .join('\n');
};

const formatHumanReport = (report) => {
  const lines = [`Score: ${report.score}/5`, `Summary: ${report.summary || 'No summary provided.'}`];

  if (report.findings.length > 0) {
    lines.push('Findings:');
    lines.push(...report.findings.map(formatFinding));
  } else {
    lines.push('Findings: none');
  }

  return `${lines.join('\n')}\n`;
};

export const normalizeReviewConfig = (config) => {
  if (!config || typeof config !== 'object') {
    return {};
  }

  const backend = typeof config.backend === 'object' && config.backend ? config.backend : {};

  return {
    repoRoot: typeof config.repoRoot === 'string' ? config.repoRoot : undefined,
    baseUrl:
      typeof config.baseUrl === 'string'
        ? config.baseUrl
        : typeof backend.baseUrl === 'string'
          ? backend.baseUrl
          : undefined,
    model:
      typeof config.model === 'string'
        ? config.model
        : typeof backend.model === 'string'
          ? backend.model
          : undefined,
    apiKey:
      typeof config.apiKey === 'string'
        ? config.apiKey
        : typeof backend.apiKey === 'string'
          ? backend.apiKey
          : undefined,
    timeoutMs:
      Number.isFinite(config.timeoutMs)
        ? config.timeoutMs
        : Number.isFinite(backend.timeoutMs)
          ? backend.timeoutMs
          : undefined,
  };
};

export const readReviewConfig = (configPath = DEFAULT_REVIEW_CONFIG_PATH) => {
  if (!configPath || !existsSync(configPath)) {
    return {};
  }

  try {
    const parsedConfig = JSON.parse(readFileSync(configPath, 'utf8'));
    return normalizeReviewConfig(parsedConfig);
  } catch (error) {
    throw new Error(`Unable to read review config at ${configPath}: ${error.message}`);
  }
};

const resolveConfig = ({ argv, env, cwd, readConfig = readReviewConfig }) => {
  const flags = parseArgs(argv);
  const configPath = flags.config || env.REVIEW_CONFIG_PATH || DEFAULT_REVIEW_CONFIG_PATH;
  const config = readConfig(configPath);

  return {
    flags,
    configPath,
    repoRoot: flags.repoRoot || config.repoRoot || cwd,
    backendConfig: {
      baseUrl: flags.baseUrl || config.baseUrl || env.REVIEW_BACKEND_BASE_URL || env.OLLAMA_HOST,
      apiKey: flags.apiKey || config.apiKey || env.REVIEW_BACKEND_API_KEY,
      model: flags.model || config.model || env.REVIEW_MODEL || env.OLLAMA_MODEL,
      timeoutMs: flags.timeoutMs
        ? Number(flags.timeoutMs)
        : config.timeoutMs
          ? Number(config.timeoutMs)
        : env.REVIEW_BACKEND_TIMEOUT_MS
          ? Number(env.REVIEW_BACKEND_TIMEOUT_MS)
          : 120000,
    },
  };
};

export const runLocalReviewCli = async ({
  argv = process.argv.slice(2),
  cwd = process.cwd(),
  env = process.env,
  stdout = process.stdout,
  stderr = process.stderr,
  collectContext = collectReviewContext,
  createBackend = createOpenAICompatibleBackend,
  runReview: runReviewFn = runReview,
  readConfig = readReviewConfig,
} = {}) => {
  const { flags, repoRoot, backendConfig } = resolveConfig({ argv, env, cwd, readConfig });

  if (flags.help) {
    stdout.write(`${buildUsage()}\n`);
    return 0;
  }

  if (!backendConfig.baseUrl || !backendConfig.model) {
    stderr.write(
      'Missing review backend configuration. Set REVIEW_BACKEND_BASE_URL and REVIEW_MODEL, or pass --base-url and --model.\n'
    );
    return 1;
  }

  try {
    const context = await collectContext({ repoRoot });
    const backend = createBackend(backendConfig);
    const report = await runReviewFn({
      diff: context.diff,
      context: context.files,
      backend,
      model: backendConfig.model,
    });

    stdout.write(flags.json ? `${JSON.stringify(report, null, 2)}\n` : formatHumanReport(report));

    return report.findings.length > 0 || report.score < 4 ? 2 : 0;
  } catch (error) {
    stderr.write(`Review run failed: ${error.message}\n`);
    return 1;
  }
};

export { formatHumanReport, parseArgs, resolveConfig };
