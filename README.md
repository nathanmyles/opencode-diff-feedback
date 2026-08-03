# opencode-diff-feedback

Inline diff annotation plugin for [opencode](https://opencode.ai). Review the diff in the initial permission ask, and if you want to provide feedback, reject the change, then run `/feedback` to open the plugin and leave line-by-line feedback.

## Features

- Rejected diffs are captured for review, file-by-file, with syntax highlighting
- Attach inline comments to individual diff lines
- Edit and delete annotations
- Collected annotations are injected back into the session prompt when you return to the chat

## Usage

When the agent proposes a change, review the diff in the permission ask dialog. If you want to provide feedback, hit **reject**, then run `/feedback` to open the plugin and leave line-by-line feedback.

> **Note:** your opencode permission settings must be configured to ask before write/edit operations, otherwise the diff will be applied without giving you a chance to review or reject it.

| Action | Keys |
| --- | --- |
| Open diff review | `/feedback` |
| Go back to the session | `esc` |
| Switch files | `←` / `→` (or `h` / `l`) |
| Move between lines | `↑` / `↓` (or `j` / `k`) |
| Add a comment on a line | `c` |
| Edit the latest comment on a line | `e` |
| Delete the latest comment on a line | `d` |

Comments are summarized back into the prompt so the agent can react to your feedback on the next turn.

## Installation

This is an opencode TUI plugin. Add it to your TUI config (`tui.json`):

```json
{
  "plugin": ["opencode-diff-feedback"]
}
```

Requires `@opencode-ai/plugin`, `@opentui/core`, `@opentui/solid`, and `solid-js`.

## Development

```bash
bun install
bun test
```

Syntax highlighting grammars are fetched into `src/grammars` by `scripts/fetch-grammars.mjs`.

## Publishing

Releases are published to npm automatically via GitHub Actions (`.github/workflows/publish.yml`), which runs typecheck, tests, and `npm publish --provenance` using npm Trusted Publishing (OIDC) — no npm token needed.

To release a new version:

1. Bump the version and create the matching tag:
   ```bash
   npm version patch   # or minor/major — bumps package.json and tags the commit
   git push --tags
   ```
2. Create a GitHub release from that tag (or `gh release create <tag> --generate-notes`).
3. The workflow publishes the exact version from the tag. It will fail if the tag and `package.json` version don't match.

## Not built by the OpenCode team

This project uses "opencode" as part of its name because it's an opencode plugin. It is not built by the OpenCode team and is not affiliated with OpenCode in any way.
