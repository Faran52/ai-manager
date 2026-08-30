# Pivot: AI Chat Manager → AI Manager

Scope moves from reading history to managing agent setup. History stays;
configuration management becomes the product. Each phase gates the next.

## Phase 2: Agent tiers

Selection criterion changes from "can we parse its history?" to "does it have a
configuration surface worth managing?". Add `capabilities: { history, manage }`
to the agent option shape; no existing reader is deleted.

- [ ] Tier 1, history + management: Claude Code, Codex, GitHub Copilot, Cursor (+ Cursor Agent), OpenCode, Gemini CLI, Antigravity, Grok CLI.
- [ ] Tier 2, management only once Tier 1 proves the adapter: Cline/Roo/Kilo, Aider, Continue, Zed, Amazon Q, Goose, Qwen Code.
- [ ] Tier 3, history only behind "More", no configuration code: the long-tail readers already built and covered.
- [ ] Improve the generic SQLite reader's project model: sessions currently
      group under `dirname(databasePath)` with no per-workspace split for
      Cursor/Zed/Goose-style stores.
- [ ] Keep `cursor` (IDE, SQLite `workspaceStorage`) and `cursor-agent` (CLI, files under `~/.cursor/projects`) as separate agents; they are different products with different storage.

## Phase 3: AgentAdapter

One adapter with a per-agent path map, not one manager per agent.

- [ ] Define `AgentAdapter`: `readConfig`, `validate`, `listMcp`, `listRules`.
- [ ] Build adapters in config-surface stability order: plain-file configs first (Claude, Codex, Gemini, OpenCode), then IDE-embedded (Cursor, Copilot), then recent formats that may still churn (Antigravity, Grok).
- [ ] Cross-agent MCP server view per project. The MCP config shape is shared across Claude, Codex, Cursor, Copilot, Gemini, Cline, and Continue.
- [ ] Cross-agent rules view per project: `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, and `.github/copilot-instructions.md` are the same concept at different paths.
- [ ] Keep model and auth configuration read-only and per-agent. This is where agents diverge; do not abstract it.

## Phase 4: Setup validation

- [ ] Report hook scripts that are missing or not executable.
- [ ] Report plugins enabled from a marketplace that is not known.
- [ ] Report MCP servers configured but never connected.
- [ ] Report relative `directory` marketplace paths that no longer resolve.

## Phase 5: Claude plugin management

One Tier 1 adapter's extra capability, not a headline feature.

- [ ] Read installed state from `~/.claude/plugins/installed_plugins.json` and `known_marketplaces.json`; read the catalog with `claude plugin list --json --available`.
- [ ] Ship the read-only inventory before any install action.
- [ ] Write only through the CLI (`claude plugin install <plugin@marketplace> -s <scope> -y`, `enable`, `disable`). Never hand-edit the registry files; the CLI owns that state.
- [ ] Timeboxed spike before committing to this phase: confirm `claude plugin install` behaves correctly as a subprocess of the Deno desktop shell (PATH, environment, trust prompts).

## Phase 6: Per-project cost and usage

The differentiator. No comparable tool surfaces this.

- [ ] Surface per-project `lastCost`, token totals, cache reads, and `lastModelUsage` from `~/.claude.json` under `projects[path]`.
- [ ] Attribute context cost to enabled plugins using `claude plugin details`.

# Structure cleanup

On hold, planned as one pass.

- [ ] Move every flat-laid-out UI component into its own kebab-case folder holding
      `SameFile.tsx` and `SameFile.test.tsx`, leaving the barrel export file where it is.
- [ ] Extract any reusable component that currently lives inside a `partials` file.
- [ ] One entry file per `lib/services` module: `*Service.ts` at the root, `./utils/*Utils`
      split by category, `./partials` holding only PascalCase `.tsx` files, and `constants.ts`
      the only place constants live. Nothing else in those folders.
- [ ] Fold in any other code refinement identified along the way.

# Open defects

- [ ] Confirm the modal enter and exit animations look right in a foreground tab. The wiring is in place and the timings were slowed, but automation runs in a hidden tab where `requestAnimationFrame` never fires, so smoothness was never actually observed.

# Toolchain follow-ups

- [ ] Re-scaffold against the next `@linteljs/create` release and confirm this project's local workarounds are no longer needed. Items 1-12 of `~/Desktop/linteljs-bug-report.md` are fixed in the scaffolder source but unreleased, so `astro.config.mjs` here still carries a hand-written React Compiler block that the template will emit itself. Decided along the way: swc for non-Astro targets and the Babel passthrough for Astro (item 11), and a first-party `@linteljs/no-duplicate-jsx-props` rule rather than an `eslint-plugin-react` dependency (item 6).
