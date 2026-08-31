# AI Manager

**English** ·
[العربية](docs/readme/README.ar.md) ·
[日本語](docs/readme/README.ja.md) ·
[한국어](docs/readme/README.ko.md) ·
[简体中文](docs/readme/README.zh-CN.md) ·
[繁體中文](docs/readme/README.zh-TW.md)

A fast, local-first viewer for AI coding-session history. Reads transcripts
straight off disk: no daemon, no account, no telemetry.

An [Astro](https://astro.build) island app, shipped to the desktop with
[Deno Desktop](https://docs.deno.com/runtime/desktop/) (Deno ≥ 2.9).

![Session transcript with expandable tool cards](docs/screenshots/sessions.jpg)

## Supported agents

| Agent | Reads | Tool calls |
|---|---|---|
| Claude Code | `~/.claude/projects` JSONL | yes |
| Codex CLI | `~/.codex` JSONL | yes |
| GitHub Copilot | VS Code `chatSessions` journals | yes |
| OpenCode | SQLite store | yes |
| Cursor | `state.vscdb` (`cursorDiskKV`) | yes |
| Gemini CLI | `~/.gemini/tmp/*/chats` logs | yes |
| Antigravity CLI | `~/.gemini/antigravity-cli` brain transcripts | step markers |
| Goose, Zed, Amazon Q, Kiro, ForgeCode | SQLite | varies |
| Cline, Aider, Continue, Qwen and ~15 more | files | text only |

Every agent normalises into one timeline model, so the viewer looks the same
whichever tool produced the session.

## Screenshots

| Analytics | Agent health |
|---|---|
| ![Token and tool analytics](docs/screenshots/analytics.jpg) | ![Per-agent setup and spend](docs/screenshots/health.jpg) |

![Arabic right-to-left interface](docs/screenshots/rtl-arabic.jpg)

## Install

Download the build for your platform from the
[latest release](https://github.com/Faran52/ai-manager/releases/latest).

Builds are not signed with a paid Developer ID, so the OS quarantines the
download until you clear it once. The file is fine; the OS just distrusts
publishers who have not paid for a certificate.

- **macOS.** Clear the quarantine flag, then open the app normally:
  ```bash
  xattr -dr com.apple.quarantine "/Applications/AI Manager.app"
  ```
  Use `sudo` if the app is in `/Applications` and your account is not an
  administrator, or move it to `~/Applications` first. The GUI route is
  **System Settings → Privacy & Security → Open Anyway**, under the notice that
  appears after the first blocked launch.
- **Windows.** SmartScreen shows *Windows protected your PC* → *More info* →
  *Run anyway*.
- **Linux.** `chmod +x AIManager-linux.AppImage`, then run it.

A build you compiled yourself never carries the quarantine flag, so it skips
all of this.

## Develop

```bash
pnpm install

pnpm dev            # web dev server
pnpm check          # lint, stylelint, types, tests (100%), build
pnpm desktop        # build once, then compile and launch the desktop app
pnpm desktop:dev    # desktop shell around the dev server, hot reload
```

The Node-adapter server also runs standalone: `node dist/server/entry.mjs`.

Structure is the LintelJS layout, with
`plugins/linteljs/skills/linteljs/SKILL.md` as the contract:

```
src/
  pages/index.astro    the single client island
  pages/api/*.ts        POST endpoints, kebab-case file name = URL segment
  components/ui/        primitives
  components/features/  app-shell, sidebar, session-viewer, analytics, ...
  lib/services/         on-disk readers, one <domain>Service.ts per folder
  lib/apis/             wire contracts, endpoint handlers, typed fetch client
  i18n/                 runtime, config, locale namespaces
```

Data flows `island → apiClient → /api route → service → on-disk histories`.
Services never touch HTTP; a domain is reached only through its
`@services/<domain>` facade, which lint enforces.

## Features

- Projects and sessions browsing with filters, previews, custom titles
- Rich transcript rendering: markdown, syntax-highlighted code, collapsible
  thinking, per-tool cards with unified diffs, todo lists, images, stdout/stderr
- Agent-sidechain toggle, incremental paging
- Cross-project full-text search with jump-to-message
- Token and cost analytics: models, tools, activity heatmap, top sessions
- Agent health: hooks, plugins, MCP servers, and per-project spend
- Archive manager with a retention policy that runs before agents prune
- Export sessions as Markdown or JSON
- Six UI languages including right-to-left Arabic with a mirrored layout
- Dark / light / system theme, keyboard search (`/`, ⌘K)
- Update checks against a signed release feed ([RELEASE.md](RELEASE.md))

## Internationalisation

A language is a folder under `src/i18n/locales/<lang>/` plus one line in
`src/i18n/config.ts`. Set `dir: 'rtl'` and the layout mirrors itself, because
the styles use logical properties (`ms`/`me`, `ps`/`pe`, `text-start`). A test
asserts every language ships the same keys with nothing blank.

## License

[MIT](LICENSE)
