# Routing

This repo is intentionally small and split by responsibility.

## Where things live

- `src/services/local-review/reviewEngine.js` - review prompt, parsing, and report normalization
- `src/services/local-review/contextCollector.js` - git diff and touched-file context collection
- `src/services/local-review/backendAdapter.js` - OpenAI-compatible backend adapter
- `src/services/local-review/cli.js` - public CLI behavior
- `scripts/review.js` - executable entry point
- `tests/services/` - behavior tests for the review stack
- `.agents/skills/review/SKILL.md` - `/review` skill wrapper
- `docs/signal-review.md` - branding and repo naming handoff

## Workflow

- Use `codex/*` branches for feature slices.
- Keep the main branch protected by PRs.
- Verify with `npm run verify` before opening a PR.
