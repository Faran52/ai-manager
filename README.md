# AI Chat Manager

A fast, local-first viewer for AI coding-session history, built as an
[Astro](https://astro.build) island app and shipped to the desktop with
[Deno Desktop](https://docs.deno.com/runtime/desktop/) (Deno ≥ 2.9).

Reads Claude Code JSONL transcripts from `~/.claude/projects`
(override with `CLAUDE_CONFIG_DIR`) — no daemon, no telemetry.

## Quick start

```bash
pnpm install

pnpm dev            # web dev server
pnpm check          # lint + stylelint + typecheck + tests(100%) + build
```

### Desktop (Deno)

```bash
pnpm desktop        # build once, then compile & launch the desktop app
pnpm desktop:dev    # desktop shell around the dev server (hot reload)
pnpm desktop:build  # produce dist/AIChatManager.app
```

Deno auto-detects Astro, embeds `dist/`, and runs the Node-adapter server
inside the Deno runtime; the UI renders in the OS webview. The same server
also runs standalone: `node dist/server/entry.mjs`.

## Architecture

LintelJS layout (`plugins/linteljs/skills/linteljs/SKILL.md` is the contract):

```
src/
  pages/
    index.astro        mounts the single client island
    api/*.ts           POST endpoints (kebab-case file = URL segment)
  components/
    ui/                primitives, motion tokens, ConfirmDialog, MarkdownText
    features/          app-shell, sidebar, session-viewer, search,
                       analytics, theme, history-data hooks
  lib/
    services/          one <domain>Service.ts entry per folder, plus
                       constants.ts and utils/*Utils.ts supporting modules:
                       agents, export, history, search, session, stats
    apis/              wire contracts, endpoint handlers, typed fetch client
    utils/             formatting, diff pairing, clipboard/download helpers
  config/              constants and CLAUDE_CONFIG_DIR resolution
```

Data flow: `island → apiClient (validated fetch) → /api route → endpoints →
services → on-disk agent histories`. Services never touch HTTP; routes are thin;
the client validates every response shape before use. Outside a service domain,
imports go through its facade (`@services/<domain>`); lint enforces this.

## Features

- Projects & sessions browsing with filters, previews, custom titles
- Rich transcript rendering: markdown, syntax-highlighted code, collapsible
  thinking, per-tool cards with unified diffs, todo lists, images, stdout/stderr
- Agent-sidechain toggle, incremental "load more" paging
- Cross-project full-text search with jump-to-message
- Token/cost analytics: models, tools, activity heatmap, top sessions
- Export sessions as Markdown or JSON
- Dark / light / system theme, keyboard search (`/`, ⌘K)

## Roadmap

Features from the original Tauri app intentionally deferred past this
migration; each slots into the existing service/endpoint pattern:

- Multi-language UI (i18n) — the source app ships 6 locales
- Archive manager, MCP server/preset managers
- Auto-updater (`Deno.autoUpdate` pairs with `desktop.release.baseUrl`)
- Subagent (sidechain) transcript drill-down, board/kanban view,
  screenshot capture, WebUI remote-login mode
