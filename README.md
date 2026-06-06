# Signal Review

Signal Review is a local-first code review tool that runs a read-only review pipeline against a repository checkout and works with any OpenAI-compatible backend, including Ollama.

It ships with:

- a reusable review engine
- a local CLI
- a `/review` skill wrapper
- structured JSON output for automation

## What it is for

- reviewing large, integrated codebases
- keeping review tooling local and low-cost
- producing stable review reports with score, summary, and findings
- fitting into agent workflows without handing control to a paid external service

## Quick Start

```bash
npm install
npm run review -- --base-url http://127.0.0.1:11434 --model qwen2.5:14b
```

For a direct executable:

```bash
node scripts/review.js --base-url http://127.0.0.1:11434 --model qwen2.5:14b
```

## Output

- Human-readable summary by default
- JSON with `--json`
- Exit codes:
  - `0` clean review
  - `2` findings present
  - `1` runtime failure

## Repository Layout

- `src/services/local-review/` - review engine, context collection, backend adapter, CLI
- `scripts/review.js` - executable entry point
- `tests/services/` - behavior tests
- `.agents/skills/review/SKILL.md` - `/review` skill wrapper
- `docs/signal-review.md` - branding and repo naming handoff

## Contributing

Use short-lived `codex/*` branches, keep changes focused, and run `npm run verify` before opening a pull request.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the branch and PR workflow.

## License

MIT
