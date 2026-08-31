# Changelog

Release notes are composed from the `## <version>` section below, so every
released version needs one. The release workflow refuses to publish a tag whose
version is missing here rather than shipping empty notes.

## 0.2.0

### Renamed to AI Manager

- The scope is moving from reading history to managing agent setup, and the name
  now matches. The repository, the bundle identifier (`com.faran52.ai-manager`),
  the release artifacts and the on-disk state directory (`~/.ai-manager`) all
  moved. An existing 0.1.0 install is a separate app and does not upgrade in
  place.

### Setup validation

- The Health tab reports hook scripts that are missing or not executable,
  plugins enabled from a marketplace this machine does not know, project MCP
  servers that were never approved, and marketplace directories that no longer
  resolve

### Faster, smaller desktop build

- The packaged app drops from 1.4 GB to about 70 MB and first launch from
  roughly twenty seconds to three: the build no longer embeds `node_modules`,
  and the unused Sharp image pipeline is gone

### Fixes

- The storage panel no longer nests a list item inside another, which React
  flagged as a hydration error
- A tool call that made several edits at once shows all of them. Each edit is
  diffed against its own fragment, so every patch claimed to start at line one
  and they collided on the same key, which let React drop one
- Deleting an archive that is already gone answers "no such archive" rather
  than an unexpected server error, and so does saving project settings without
  a project selected

## 0.1.0

First public release.

### Reads your sessions, whichever agent wrote them

- Dedicated parsers for Claude Code, Codex CLI, GitHub Copilot and OpenCode,
  each recovering tool calls, thinking, model and token usage
- Gemini CLI and Antigravity CLI read from their own on-disk stores
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
- The manifest is verified against an Ed25519 public key baked into the build, so
  an unsigned feed is rejected outright rather than trusted
