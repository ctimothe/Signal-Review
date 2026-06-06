import { execFile } from 'child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

import { describe, expect, it } from '@jest/globals';

import { collectReviewContext } from '../../src/services/local-review/contextCollector.js';

const execFileAsync = promisify(execFile);

const runGit = async (cwd, args) => {
  await execFileAsync('git', args, {
    cwd,
    maxBuffer: 10 * 1024 * 1024,
  });
};

const createTempRepo = async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'signal-review-context-'));

  await runGit(repoRoot, ['init']);
  await runGit(repoRoot, ['config', 'user.email', 'codex@example.com']);
  await runGit(repoRoot, ['config', 'user.name', 'Codex']);
  await mkdir(path.join(repoRoot, 'src'), { recursive: true });

  return repoRoot;
};

describe('collectReviewContext', () => {
  it('collects staged and unstaged changes with file content for modified files', async () => {
    const repoRoot = await createTempRepo();

    try {
      const filePath = path.join(repoRoot, 'src/example.js');
      await writeFile(filePath, 'export const answer = 1;\n');
      await runGit(repoRoot, ['add', '.']);
      await runGit(repoRoot, ['commit', '-m', 'initial']);

      await writeFile(filePath, 'export const answer = 2;\nexport const extra = true;\n');

      const context = await collectReviewContext({ repoRoot });

      expect(context.diff).toContain('export const answer = 2;');
      expect(context.diff).toContain('export const extra = true;');
      expect(context.files).toEqual([
        {
          path: 'src/example.js',
          status: 'modified',
          content: 'export const answer = 2;\nexport const extra = true;\n',
        },
      ]);
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });

  it('includes deleted files with empty content', async () => {
    const repoRoot = await createTempRepo();

    try {
      const filePath = path.join(repoRoot, 'src/deleted.js');
      await writeFile(filePath, 'export const removed = true;\n');
      await runGit(repoRoot, ['add', '.']);
      await runGit(repoRoot, ['commit', '-m', 'initial']);
      await rm(filePath);

      const context = await collectReviewContext({ repoRoot });

      expect(context.files).toEqual([
        {
          path: 'src/deleted.js',
          status: 'deleted',
          content: '',
        },
      ]);
      expect(context.diff).toContain('deleted file mode');
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });

  it('returns an empty context for a clean working tree', async () => {
    const repoRoot = await createTempRepo();

    try {
      const filePath = path.join(repoRoot, 'src/clean.js');
      await writeFile(filePath, 'export const clean = true;\n');
      await runGit(repoRoot, ['add', '.']);
      await runGit(repoRoot, ['commit', '-m', 'initial']);

      const context = await collectReviewContext({ repoRoot });

      expect(context).toEqual({
        diff: '',
        files: [],
      });
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });

  it('throws when repoRoot is missing', async () => {
    await expect(collectReviewContext({})).rejects.toThrow(
      'collectReviewContext requires repoRoot'
    );
  });
});
