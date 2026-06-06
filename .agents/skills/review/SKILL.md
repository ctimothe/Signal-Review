---
name: review
description: Run the Signal Review local read-only code review workflow through the built-in CLI wrapper. Use when the user asks for /review, wants a repo-scoped review, or wants the local review engine launched from Codex/VS Code without external paid services.
---

# /review

Run the repository-local review pipeline and report the result without editing code.

## Workflow

1. Resolve the repository root from the current workspace.
2. Run the local review CLI from `scripts/review.js`.
3. Use the configured OpenAI-compatible backend endpoint and model.
4. Keep the run read-only. Do not commit, push, or modify files.
5. Present the human summary first.
6. If the user asks for machine-readable output, rerun with JSON output enabled.

## Default Command

Use the local review script directly:

```bash
node scripts/review.js \
  --repo-root "$(git rev-parse --show-toplevel)" \
  --base-url "${REVIEW_BACKEND_BASE_URL:-http://127.0.0.1:11434}" \
  --model "${REVIEW_MODEL:-qwen2.5:14b}"
```

## Output Rules

- Summarize the score, summary, and top findings in plain language.
- Mention the structured report path only if the CLI printed JSON or the user asked for automation output.
- If the backend is missing or misconfigured, say exactly which setting is missing and how to provide it.
- If the review finds issues, describe them without changing code.

## Safety Rules

- Never call paid review services from this skill.
- Never auto-fix code in this wrapper.
- Never stage, commit, or push.
- Treat the local CLI as the single source of execution logic.
