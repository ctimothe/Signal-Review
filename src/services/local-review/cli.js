import { createOpenAICompatibleBackend } from './backendAdapter.js';
import { collectReviewContext } from './contextCollector.js';
import { runReview } from './reviewEngine.js';

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

const resolveConfig = ({ argv, env, cwd }) => {
  const flags = parseArgs(argv);

  return {
    flags,
    repoRoot: flags.repoRoot || cwd,
    backendConfig: {
      baseUrl: flags.baseUrl || env.REVIEW_BACKEND_BASE_URL || env.OLLAMA_HOST,
      apiKey: flags.apiKey || env.REVIEW_BACKEND_API_KEY,
      model: flags.model || env.REVIEW_MODEL || env.OLLAMA_MODEL,
      timeoutMs: flags.timeoutMs
        ? Number(flags.timeoutMs)
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
} = {}) => {
  const { flags, repoRoot, backendConfig } = resolveConfig({ argv, env, cwd });

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
