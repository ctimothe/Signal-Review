const DEFAULT_TIMEOUT_MS = 30000;

const buildBaseUrl = (baseUrl) => {
  if (!baseUrl) {
    throw new TypeError('createOpenAICompatibleBackend requires a baseUrl');
  }

  return baseUrl.replace(/\/+$/, '');
};

const readAssistantContent = (payload) => {
  const content = payload?.choices?.[0]?.message?.content;

  if (typeof content !== 'string') {
    throw new Error('OpenAI-compatible backend response did not include assistant content');
  }

  return content;
};

const buildRequestBody = ({ model, messages, responseFormat }) => {
  const body = {
    model,
    messages,
  };

  if (responseFormat === 'json') {
    body.response_format = { type: 'json_object' };
  }

  return body;
};

export const createOpenAICompatibleBackend = ({
  baseUrl,
  apiKey,
  model,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = globalThis.fetch,
} = {}) => {
  const normalizedBaseUrl = buildBaseUrl(baseUrl);

  if (!model) {
    throw new TypeError('createOpenAICompatibleBackend requires a model');
  }

  if (typeof fetchImpl !== 'function') {
    throw new TypeError('createOpenAICompatibleBackend requires fetch support');
  }

  const complete = async ({ messages, responseFormat = 'text' }) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(`${normalizedBaseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify(buildRequestBody({ model, messages, responseFormat })),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(
          `OpenAI-compatible backend request failed with status ${response.status}${
            errorText ? `: ${errorText}` : ''
          }`
        );
      }

      const payload = await response.json();
      return readAssistantContent(payload);
    } finally {
      clearTimeout(timeout);
    }
  };

  return {
    complete,
  };
};
