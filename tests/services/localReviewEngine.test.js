import { describe, expect, it, jest } from '@jest/globals';

import { runReview } from '../../src/services/local-review/reviewEngine.js';

describe('runReview', () => {
  it('returns a structured review report from a diff and mocked backend', async () => {
    const backend = {
      complete: jest.fn().mockResolvedValue(
        JSON.stringify({
          score: 4,
          summary: 'One medium-risk issue found in the changed route.',
          findings: [
            {
              severity: 'medium',
              file: 'src/routes/example.js',
              line: 12,
              title: 'Missing error handling',
              message: 'The new await path can reject without returning a controlled response.',
              recommendation: 'Wrap the call and return a stable error response.',
            },
          ],
        })
      ),
    };

    const report = await runReview({
      diff: [
        'diff --git a/src/routes/example.js b/src/routes/example.js',
        '@@ -10,2 +10,4 @@',
        '+const result = await externalCall();',
        '+return res.json(result);',
      ].join('\n'),
      context: [
        {
          path: 'src/routes/example.js',
          content: 'export const handler = async (req, res) => { /* changed route */ };',
        },
      ],
      backend,
      model: 'local-coder',
    });

    expect(report).toMatchObject({
      version: 1,
      score: 4,
      summary: 'One medium-risk issue found in the changed route.',
      backend: {
        model: 'local-coder',
      },
      findings: [
        {
          severity: 'medium',
          file: 'src/routes/example.js',
          line: 12,
          title: 'Missing error handling',
          message: 'The new await path can reject without returning a controlled response.',
          recommendation: 'Wrap the call and return a stable error response.',
        },
      ],
    });
    expect(report.findings[0].id).toEqual(expect.any(String));
    expect(backend.complete).toHaveBeenCalledTimes(1);
  });
});
