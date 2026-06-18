# Project Context

Keep this file current. It is the compact source of truth for the agent.

## Purpose

- What this project does: local-first code review tooling with a `/review` skill and CLI

## Stack

- Shape: Node.js
- Package manager: npm
- Runtime: Node 22+
- Review backend: OpenAI-compatible endpoints, including Ollama

## Commands

- Install: `npm install`
- Review: `npm run review`
- macOS app package: `npm run package:macos`
- Lint: `npm run lint`
- Test: `npm run test`
- Verify: `npm run verify`

## Package scripts

- `review` - launch the local review CLI
- `package:macos` - stage the macOS app bundle and DMG
- `lint` - run ESLint across source, tests, and scripts
- `test` - run the Jest suite
- `verify` - run lint and tests
- `format` - run Prettier across repository text files

## Agent workflow notes

- Relevant skills: `review`, `tdd`, `skill-creator`
- Relevant docs: `AGENTS.md`, `CONTEXT.md`, `ROUTING.md`, `CLAUDE.md`, `README.md`, `docs/`
- Known rules / caveats:
  - review runs are read-only
  - the CLI is backend-agnostic
  - do not depend on paid external review services
- Things the agent should never do without asking:
  - stage, commit, or push outside the requested branch/PR flow
  - auto-fix code from the review skill

## Current priorities

- Finish the standalone Signal Review repo scaffold and open-source workflow
