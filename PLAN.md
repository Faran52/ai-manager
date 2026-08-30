# AI Manager

The product reads agent history and manages agent setup. History is done and
stays; configuration management is where the work is. Each phase gates the next.

## Shipped

- Rename from AI Chat Manager. Repo, bundle identifier, artifacts, and the
  on-disk state directory all moved.
- **Setup validation** (was Phase 4). `validationUtils` reports missing or
  non-executable hooks, plugins enabled from an unknown marketplace, project MCP
  servers that were never approved, and marketplace directories that no longer
  resolve. Surfaced in the Health tab.
- **Read-only plugin inventory** (part of Phase 5). `pluginsUtils` reads
  `installed_plugins.json` and `known_marketplaces.json`; `PluginInventory` shows
  it. Write actions through the CLI are still open, below.
- **Per-project cost** (part of Phase 6). `usageUtils` reads `lastCost`,
  `lastModelUsage`, and cache reads from `~/.claude.json`; `ProjectUsageCard`
  shows it. Plugin cost attribution is still open, below.
- **ui primitives** each live in their own kebab-case folder; `stats` utils moved
  under `stats/utils`.

## Phase 2: Agent tiers

Selection criterion changes from "can we parse its history?" to "does it have a
configuration surface worth managing?". Add `capabilities: { history, manage }`
to the agent option shape; no existing reader is deleted.

- [ ] Tier 1, history + management: Claude Code, Codex, GitHub Copilot, Cursor (+ Cursor Agent), OpenCode, Gemini CLI, Antigravity, Grok CLI.
- [ ] Tier 2, management only once Tier 1 proves the adapter: Cline/Roo/Kilo, Aider, Continue, Zed, Amazon Q, Goose, Qwen Code.
- [ ] Tier 3, history only behind "More", no configuration code: the long-tail readers already built and covered.
- [ ] Improve the generic SQLite reader's project model: `sqliteUtils` still falls
      back to `dirname(databasePath)` at one call site, with no per-workspace split
      for Cursor/Zed/Goose-style stores.
- [ ] Keep `cursor` (IDE, SQLite `workspaceStorage`) and `cursor-agent` (CLI, files under `~/.cursor/projects`) as separate agents; they are different products with different storage.

## Phase 3: AgentAdapter

`setupUtils` already reads MCP servers and rules files per agent through a path
map, which is the shape this phase wants. What is left is naming it and giving it
the write and validate halves.

- [ ] Define `AgentAdapter`: `readConfig`, `validate`, `listMcp`, `listRules`, folding in `setupUtils` and `validationUtils`.
- [ ] Build adapters in config-surface stability order: plain-file configs first (Claude, Codex, Gemini, OpenCode), then IDE-embedded (Cursor, Copilot), then recent formats that may still churn (Antigravity, Grok).
- [ ] Keep model and auth configuration read-only and per-agent. This is where agents diverge; do not abstract it.

## Phase 5: Claude plugin write actions

The read-only inventory ships. This is the write half.

- [ ] Write only through the CLI (`claude plugin install <plugin@marketplace> -s <scope> -y`, `enable`, `disable`). Never hand-edit the registry files; the CLI owns that state.
- [ ] Timeboxed spike first: confirm `claude plugin install` behaves correctly as a subprocess of the Deno desktop shell (PATH, environment, trust prompts).

## Phase 6: Plugin cost attribution

Per-project cost ships. This attributes a slice of it to plugins.

- [ ] Attribute context cost to enabled plugins using `claude plugin details`.

## Structure follow-ups

- [ ] Extract components that are actually reused out of feature `partials` folders into `components/ui` or a shared feature.
- [ ] Normalise the rest of `lib/services`: decide where ambient `types.ts` lives, and fold `updates/updateConfig.ts` into the `*Service` / `*Utils` convention.
