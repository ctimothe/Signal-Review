const REVIEW_REPORT_VERSION = 1;

const REVIEW_SYSTEM_PROMPT = [
  'You are a local code review engine.',
  'Review only the provided diff and context.',
  'Return strict JSON with score, summary, and findings.',
].join(' ');

const createUserPrompt = ({ diff, context }) => {
  const contextText = (context || [])
    .map((entry) => `File: ${entry.path}\n${entry.content}`)
    .join('\n\n');

  return [
    'Review this change and return a JSON review report.',
    '',
    'Diff:',
    diff || '',
    '',
    'Context:',
    contextText || 'No additional context provided.',
  ].join('\n');
};

const parseBackendResponse = (response) => {
  if (typeof response === 'string') {
    return JSON.parse(response);
  }

  return response || {};
};

const normalizeScore = (score) => {
  const parsed = Number(score);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.min(5, parsed));
};

const createFindingId = (finding, index) => {
  const parts = [
    index + 1,
    finding.severity || 'unknown',
    finding.file || 'unknown-file',
    finding.line || 0,
    finding.title || 'untitled',
  ];

  return parts
    .join(':')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
};

const normalizeFinding = (finding, index) => ({
  id: finding.id || createFindingId(finding, index),
  severity: finding.severity || 'info',
  file: finding.file || null,
  line: Number.isInteger(finding.line) ? finding.line : null,
  title: finding.title || 'Review finding',
  message: finding.message || '',
  recommendation: finding.recommendation || '',
});

export const runReview = async ({ diff, context = [], backend, model = 'unknown' }) => {
  if (!backend || typeof backend.complete !== 'function') {
    throw new TypeError('runReview requires a backend with a complete() function');
  }

  const rawResponse = await backend.complete({
    messages: [
      { role: 'system', content: REVIEW_SYSTEM_PROMPT },
      { role: 'user', content: createUserPrompt({ diff, context }) },
    ],
    responseFormat: 'json',
  });
  const parsed = parseBackendResponse(rawResponse);
  const findings = Array.isArray(parsed.findings) ? parsed.findings : [];

  return {
    version: REVIEW_REPORT_VERSION,
    score: normalizeScore(parsed.score),
    summary: parsed.summary || '',
    findings: findings.map(normalizeFinding),
    backend: {
      model,
    },
  };
};
