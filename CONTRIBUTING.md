# Contributing

Signal Review is intended to be easy to contribute to with small, reviewable changes.

## Branch Workflow

- Create feature branches with the `codex/` prefix by default.
- Keep branches short-lived and purpose-specific.
- Open pull requests into `main`.
- Use descriptive commit messages with a clear scope, such as `feat:`, `docs:`, or `test:`.

## Local Checks

Run the repository checks before opening a PR:

```bash
npm run verify
```

## Review Scope

- Keep the review engine read-only.
- Do not add paid external review services.
- Prefer backend-agnostic changes when adding integrations.

## Documentation

- Update `README.md` when usage changes.
- Update `docs/signal-review.md` when the product naming changes.
- Update `.agents/skills/review/SKILL.md` when the `/review` workflow changes.

## Pull Requests

- Include the observable behavior you changed.
- Include the checks you ran.
- Keep PRs small enough to review quickly.
