import { execFile } from 'child_process';
import { readFile } from 'fs/promises';
import path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const STATUS_LABELS = {
  M: 'modified',
  A: 'added',
  D: 'deleted',
  R: 'renamed',
  C: 'copied',
  '?': 'untracked',
};

const runGit = async (repoRoot, args) => {
  const { stdout } = await execFileAsync('git', args, {
    cwd: repoRoot,
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout;
};

const parseStatusLine = (line) => {
  const statusCode = line.slice(0, 2);
  const filePath = line.slice(3);
  const statusKey = statusCode.trim()[0] || 'M';

  return {
    path: filePath,
    status: STATUS_LABELS[statusKey] || 'modified',
  };
};

const readContextFile = async (repoRoot, entry) => {
  if (entry.status === 'deleted') {
    return {
      ...entry,
      content: '',
    };
  }

  const absolutePath = path.resolve(repoRoot, entry.path);
  const content = await readFile(absolutePath, 'utf8');

  return {
    ...entry,
    content,
  };
};

export const collectReviewContext = async ({ repoRoot }) => {
  if (!repoRoot) {
    throw new TypeError('collectReviewContext requires repoRoot');
  }

  const [unstagedDiff, stagedDiff, statusOutput] = await Promise.all([
    runGit(repoRoot, ['diff', '--', '.']),
    runGit(repoRoot, ['diff', '--cached', '--', '.']),
    runGit(repoRoot, ['status', '--porcelain', '--', '.']),
  ]);

  const changedFiles = statusOutput.split('\n').filter(Boolean).map(parseStatusLine);
  const files = await Promise.all(changedFiles.map((entry) => readContextFile(repoRoot, entry)));

  return {
    diff: [unstagedDiff, stagedDiff].filter(Boolean).join('\n'),
    files,
  };
};
