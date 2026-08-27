# Changelog

Release notes are composed from the `## <version>` section below, so every
released version needs one. The release workflow refuses to publish a tag whose
version is missing here rather than shipping empty notes.

## 0.1.0

First public release.

### Reads your sessions, whichever agent wrote them

- Dedicated parsers for Claude Code, Codex CLI, GitHub Copilot and OpenCode,
  each recovering tool calls, thinking, model and token usage
- Cursor, Goose and Zed read from their SQLite stores; around twenty more agents
  render as text through the generic file parser
- Every agent normalises into one timeline model, so the viewer looks the same
  whichever tool produced the session

### Reading a session

- Markdown with syntax-highlighted code, collapsible thinking, per-tool cards
  carrying unified diffs, todo lists, images and stdout/stderr
- Message filters by participant and content type, incremental paging
- Cross-project full-text search that jumps to the message
- Export as Markdown or JSON

### Analytics

- Token and cost totals, models by request, tool call counts, activity heatmap
  and top sessions, per project

### Six languages

- English, العربية, 日本語, 한국어, 简体中文 and 繁體中文
- Arabic is right-to-left with a fully mirrored layout, and carries all six
  Arabic plural categories including the dual
- Relative timestamps come from `Intl.RelativeTimeFormat`, so they are correct
  per locale without translation keys

### Updates

- Checks a signed release feed and offers whole-artifact updates: macOS and
  Linux hand off to a helper that waits for exit, Windows hands the msi to
  `msiexec`
- The manifest is verified against an Ed25519 public key when one is configured,
  and an unsigned feed is rejected once a key is present
