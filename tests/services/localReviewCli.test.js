import { describe, expect, it, jest } from '@jest/globals';

import { runLocalReviewCli } from '../../src/services/local-review/cli.js';

const createCapturedWriter = () => {
  const chunks = [];

  return {
    write: jest.fn((chunk) => {
      chunks.push(String(chunk));
      return true;
    }),
    toString: () => chunks.join(''),
  };
};

describe('runLocalReviewCli', () => {
  it('prints a human summary and exits with a findings code', async () => {
    const stdout = createCapturedWriter();
    const stderr = createCapturedWriter();
    const collectContext = jest.fn().mockResolvedValue({
      diff: 'diff --git a/src/routes/example.js b/src/routes/example.js',
      files: [
        {
          path: 'src/routes/example.js',
          status: 'modified',
          content: 'export const handler = async () => {};\n',
        },
      ],
    });
    const backend = { complete: jest.fn() };
    const createBackend = jest.fn().mockReturnValue(backend);
    const runReview = jest.fn().mockResolvedValue({
      version: 1,
      score: 2,
      summary: 'The change introduces a medium-risk integration gap.',
      findings: [
        {
          id: 'finding-1',
          severity: 'medium',
          file: 'src/routes/example.js',
          line: 12,
          title: 'Missing defensive check',
          message: 'The new path can continue without validating the response.',
          recommendation: 'Guard the response before continuing.',
        },
      ],
      backend: {
        model: 'qwen2.5:14b',
      },
    });

    const exitCode = await runLocalReviewCli({
      argv: ['--model', 'qwen2.5:14b', '--base-url', 'http://127.0.0.1:11434'],
      cwd: '/workspace/repo',
      env: {},
      stdout,
      stderr,
      collectContext,
      createBackend,
      runReview,
    });

    expect(exitCode).toBe(2);
    expect(stdout.toString()).toContain('Score: 2/5');
    expect(stdout.toString()).toContain('The change introduces a medium-risk integration gap.');
    expect(stdout.toString()).toContain('Missing defensive check');
    expect(stderr.toString()).toBe('');
    expect(collectContext).toHaveBeenCalledWith({ repoRoot: '/workspace/repo' });
    expect(createBackend).toHaveBeenCalledWith({
      apiKey: undefined,
      baseUrl: 'http://127.0.0.1:11434',
      model: 'qwen2.5:14b',
      timeoutMs: 120000,
    });
    expect(runReview).toHaveBeenCalledWith({
      backend,
      context: [
        {
          content: 'export const handler = async () => {};\n',
          path: 'src/routes/example.js',
          status: 'modified',
        },
      ],
      diff: 'diff --git a/src/routes/example.js b/src/routes/example.js',
      model: 'qwen2.5:14b',
    });
  });

  it('can emit a machine-readable report for a clean review', async () => {
    const stdout = createCapturedWriter();
    const stderr = createCapturedWriter();
    const collectContext = jest.fn().mockResolvedValue({
      diff: '',
      files: [],
    });
    const backend = { complete: jest.fn() };
    const createBackend = jest.fn().mockReturnValue(backend);
    const report = {
      version: 1,
      score: 5,
      summary: 'Nothing material to flag.',
      findings: [],
      backend: {
        model: 'qwen2.5:14b',
      },
    };
    const runReview = jest.fn().mockResolvedValue(report);

    const exitCode = await runLocalReviewCli({
      argv: ['--model', 'qwen2.5:14b', '--base-url', 'http://127.0.0.1:11434', '--json'],
      cwd: '/workspace/repo',
      env: {},
      stdout,
      stderr,
      collectContext,
      createBackend,
      runReview,
    });

    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout.toString())).toEqual(report);
    expect(stderr.toString()).toBe('');
    expect(createBackend).toHaveBeenCalledWith({
      apiKey: undefined,
      baseUrl: 'http://127.0.0.1:11434',
      model: 'qwen2.5:14b',
      timeoutMs: 120000,
    });
  });

  it('loads repo and backend defaults from a saved config file', async () => {
    const stdout = createCapturedWriter();
    const stderr = createCapturedWriter();
    const collectContext = jest.fn().mockResolvedValue({
      diff: '',
      files: [],
    });
    const backend = { complete: jest.fn() };
    const createBackend = jest.fn().mockReturnValue(backend);
    const runReview = jest.fn().mockResolvedValue({
      version: 1,
      score: 5,
      summary: 'Nothing material to flag.',
      findings: [],
      backend: {
        model: 'qwen2.5:14b',
      },
    });
    const readConfig = jest.fn().mockReturnValue({
      repoRoot: '/workspace/repo-from-config',
      baseUrl: 'http://127.0.0.1:11434',
      model: 'qwen2.5:14b',
      timeoutMs: 90000,
    });

    const exitCode = await runLocalReviewCli({
      argv: ['--config', '/Users/test/Library/Application Support/Signal Review/config.json'],
      cwd: '/workspace/ignored',
      env: {},
      stdout,
      stderr,
      collectContext,
      createBackend,
      runReview,
      readConfig,
    });

    expect(exitCode).toBe(0);
    expect(readConfig).toHaveBeenCalledWith('/Users/test/Library/Application Support/Signal Review/config.json');
    expect(collectContext).toHaveBeenCalledWith({ repoRoot: '/workspace/repo-from-config' });
    expect(createBackend).toHaveBeenCalledWith({
      apiKey: undefined,
      baseUrl: 'http://127.0.0.1:11434',
      model: 'qwen2.5:14b',
      timeoutMs: 90000,
    });
    expect(stderr.toString()).toBe('');
    expect(stdout.toString()).toContain('Score: 5/5');
  });

  it('returns a runtime failure code when review collection fails', async () => {
    const stdout = createCapturedWriter();
    const stderr = createCapturedWriter();

    const exitCode = await runLocalReviewCli({
      argv: ['--model', 'qwen2.5:14b', '--base-url', 'http://127.0.0.1:11434'],
      cwd: '/workspace/repo',
      env: {},
      stdout,
      stderr,
      collectContext: jest.fn().mockRejectedValue(new Error('git is unavailable')),
      createBackend: jest.fn(),
      runReview: jest.fn(),
    });

    expect(exitCode).toBe(1);
    expect(stdout.toString()).toBe('');
    expect(stderr.toString()).toContain('Review run failed: git is unavailable');
  });
});
