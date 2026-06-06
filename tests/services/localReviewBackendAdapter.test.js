import { describe, expect, it, jest } from '@jest/globals';

import { createOpenAICompatibleBackend } from '../../src/services/local-review/backendAdapter.js';

const createResponse = ({ ok, status, body }) => ({
  ok,
  status,
  json: jest.fn().mockResolvedValue(body),
  text: jest.fn().mockResolvedValue(JSON.stringify(body)),
});

describe('createOpenAICompatibleBackend', () => {
  it('posts a chat completion request and returns the model response content', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      createResponse({
        ok: true,
        status: 200,
        body: {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  score: 4,
                  summary: 'Looks good.',
                  findings: [],
                }),
              },
            },
          ],
        },
      })
    );

    const backend = createOpenAICompatibleBackend({
      baseUrl: 'http://127.0.0.1:11434/',
      apiKey: 'test-key',
      model: 'qwen2.5:14b',
      timeoutMs: 1000,
      fetchImpl,
    });

    const content = await backend.complete({
      messages: [{ role: 'user', content: 'review this diff' }],
      responseFormat: 'json',
    });

    expect(content).toEqual(
      JSON.stringify({
        score: 4,
        summary: 'Looks good.',
        findings: [],
      })
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer test-key',
        },
        body: JSON.stringify({
          model: 'qwen2.5:14b',
          messages: [{ role: 'user', content: 'review this diff' }],
          response_format: { type: 'json_object' },
        }),
      })
    );
  });

  it('throws a clear error when the backend returns a non-200 response', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: jest.fn(),
      text: jest.fn().mockResolvedValue('model unavailable'),
    });

    const backend = createOpenAICompatibleBackend({
      baseUrl: 'http://127.0.0.1:11434',
      model: 'qwen2.5:14b',
      fetchImpl,
    });

    await expect(
      backend.complete({
        messages: [{ role: 'user', content: 'review this diff' }],
      })
    ).rejects.toThrow('OpenAI-compatible backend request failed with status 503: model unavailable');
  });
});
