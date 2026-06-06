# Signal Review Branding

This document captures the public-facing naming for the standalone review tool.

## Recommended Naming

- Public repository: `Signal-Review`
- Package name: `signal-review`
- Product name: `Signal Review`
- CLI command: `review`
- Skill trigger: `/review`
- Model/backend config prefix: `REVIEW_*`

## Why This Shape

- `review` stays short and ergonomic for the user-facing trigger.
- `Signal Review` is explicit enough to communicate that the tool is about code review signals, not generic AI chat.
- `signal-review` is compact enough for a package name.

## Notes

- The current repo keeps the review implementation under `src/services/local-review/`.
- This file is the handoff point for the public repo’s brand and package naming.
- Before launch, verify the final GitHub handle, npm scope, and domain availability.
