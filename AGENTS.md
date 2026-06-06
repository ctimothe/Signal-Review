# Signal Review Agent Guardrails

## Project Shape

- Signal Review is a local-first, read-only code review tool.
- The core code lives under `src/services/local-review/`.
- The executable wrapper lives at `scripts/review.js`.
- The `/review` skill lives at `.agents/skills/review/SKILL.md`.

## Default Rules

- Prefer small, behavior-focused changes.
- Keep the review engine backend-agnostic.
- Do not introduce paid external services as a hard dependency.
- Treat the CLI as the source of truth for execution behavior.
- Use `npm run verify` after meaningful changes.

## Branching

- Use `codex/*` branches for agent work by default.
- Merge changes into `main` through pull requests.
- Keep commits and PRs scoped to a single slice when possible.

## Safety

- Do not auto-edit code from the review skill.
- Keep the workflow read-only unless the user explicitly asks for remediation.
- Avoid deleting or rewriting unrelated files.
