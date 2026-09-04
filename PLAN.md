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
- **Per-project cost** (was Phase 6 part one). `usageUtils` reads `lastCost`,
  `lastModelUsage`, and cache reads from `~/.claude.json`; `ProjectUsageCard`
  shows it.
- **Agent tiers** (Phase 2). `AgentOption` carries `capabilities: { history,
  manage }`; Tier 1 and Tier 2 agents claim the manage surface, Tier 3 stays
  history only. `managedAgents` is derived from the capability plus adapter
  presence, so a tier agent surfaces the moment its adapter lands.
- **Managed-agent registry** (Phase 3). `setupUtils` owns the per-agent path map
  (`SPECS`) and exposes `hasAgentSetup`; `managedAgents` is the intersection of
  that and `capabilities.manage`. The Health endpoint walks `managedAgents`.
  The separate `adapters/` layer was removed: it hand-listed the same nine
  agents `SPECS` already keys, and its `listMcp` / `listRules` were never
  called. Only Claude has a validator, so the endpoint calls it directly.
- **Model and auth** (Phase 3). `modelAuthUtils` reads the model and auth method
  per agent format, read-only, and `AgentSetup` carries it.
- **Plugin write actions** (Phase 5). `pluginActionsUtils` runs `claude plugin
  install <plugin@marketplace> -s <scope> -y`, `enable`, and `disable` through
  `claudeCliUtils`; the registry files are never hand-edited. The spike
  concluded in `--allow-run=claude` on the desktop scripts and `-y` on installs,
  because the desktop shell is never a TTY. The Health tab toggles enable and
  disable per installed plugin.
- **Plugin cost attribution** (Phase 6). `pluginCostUtils` reads `claude plugin
  details` per enabled plugin, reports always-on and peak per-invoke token
  estimates, and prices the always-on slice at the project's blended input-token
  rate. On demand from the plugin table.
- **Model pricing from what Claude Code billed.** Pricing was observation-only:
  a model got a rate when a transcript entry carried a cost. Copilot and
  OpenCode record one, Claude Code does not, so the four largest models, about
  97% of billed tokens, priced at nothing and coverage sat at 2.2%. The open
  weight models were never the problem; they were the only ones working.
  `readModelCosts` pools `projects[*].lastModelUsage` from `~/.claude.json` per
  model, and `summarizePricing` falls back to it. Only the ratio is wanted, so
  a per-project sample of the history is enough. Claude Code names a model with
  its context tier (`claude-opus-5[1m]`) where a transcript names it bare, and
  `modelKey` folds the tier off to let the two meet. Coverage 2.2% to 97.8%.
- **A plugin cost column that was reading zero.** `attributePluginCosts` priced
  always-on context off one project's `lastCost`, which is a last-session
  running total flushed at session end: an open session zeroes it, so the rate
  collapsed exactly while the app was in use. It now falls back to the same
  pooled rate, preferring the project's own figure when it has a real one.
- **ui primitives** each live in their own kebab-case folder; `stats` utils moved
  under `stats/utils`; `updates/updateConfig.ts` folded into
  `updates/utils/updateConfigUtils.ts`.

- **Cline tool results pair back to their calls.** Cline returns a result as
  the next user message, as text like `[<tool> for '<arg>'] Result:` followed
  by the output, and nothing linked the two, so every row read "Pending".
  `clineOutcomeUtils` parses those sections and pairs them, in order, with the
  calls of the assistant turn above, because Cline emits one call per result
  and carries no ids. Cline's own regex stops at the first quote, which breaks
  on an argument containing one; matching to the last `'] Result:` on the line
  recovered the rest of the session. Status strings come from the installed
  extension's `formatResponse` output rather than a guess.
  `<environment_details>` joined `INJECTED_CONTEXT_PREFIXES`, and because Cline
  appends that block to the very message holding the typed prompt,
  `splitUserText` now reads an authored block before splitting on a marker or
  the prompt would sit behind its own raw markup. A `todo-write` card no longer
  shows "Pending" either: a checklist is the whole content of its own call.
- **Session things live under Sessions.** Five complaints were one problem.
  Threads group on `rootUuid`, the uuid of a transcript's first message, since
  rewinding records the messages up to that point again in a fresh file; the
  2-minute-gap heuristic it replaces measured 0/7 precision and is deleted
  rather than kept as a fallback. `PromptHistoryPanel` became a "Prompts only"
  toggle in Search, which already searched every agent, and its sole dependents
  went with it (`usePrompts`, `/api/prompts`, `handlePromptHistory`,
  `fetchPrompts`, `PromptsResponse`, `readPromptHistory`). Sessions owns
  Transcript, Board and File edits; Analytics is only the report.
- **Data marks grow into place.** The bar fill sat on the shared expo-out
  curve, which covers most of its distance in the first tenth of the tween, so
  at 0.3s a bar read as though it had always been full. Marks have their own
  slower cubic curve and a stagger. `WorkRhythm`'s hour and weekday bars had no
  animation at all and now grow from nothing, sharing one sweep so 24 hours and
  7 weekdays take the same time to fill. `ActivityHeatmap` fades in a month at a
  time, because staggering days would mount 365 animations to sweep a grid that
  already reads as columns. `data-bar-fill` and `data-rhythm-height` carry the
  settled percentage, since a size read mid-tween is not the proportion.
- **The Health tab is a table whose rows explain themselves.** The agent list
  was pseudo-columns with no header, so every figure carried its own label and
  read as a debug dump. One header row governs them and the labels are gone.
  Opening a row used to name the things it had just counted; it now holds what
  a count cannot: which server at what scope, out of which file, how stale a
  rules file has gone, and why the row is flagged. A group the agent records
  nothing for prints no line, so a rules-only agent opens to one line. Each
  artefact is a chip on the shared `Badge`, which is why twelve MCP servers
  wrap within their own line rather than scrolling or truncating.
  Findings moved into the agent they name, and the first flagged row opens
  itself, so a summary list above the table was a second copy of them.
  The MODEL column is gone: `modelAuth.model` is the default configured in
  settings, not what the sessions used, and a project's sessions routinely span
  several models, which Analytics already reports. Credentials are named only
  when one exists, because Claude reports none whenever `settings.json` holds no
  key, the ordinary subscription case, so "No credentials" was untrue.
  The plugin inventory and its cost estimate moved out of the inline row into a
  dialog, and the two tables became one: the cost table repeated every plugin
  name to add three numbers about it. Cost is priced per thousand turns, since
  always-on context is re-sent every turn and a per-turn figure floored at
  "<$0.0001" for most plugins and said nothing.

- **Skills and subagents counted by name.** Skill and Task were one bar each in
  the tool list, which said a skill ran but never which one; on this machine
  that hid seven skills behind a single bar. Both names were already parsed,
  Task through to `kind: 'task'` and Skill only into a presentational row, so
  Skill gained the first-class kind Task already had rather than having the
  stats layer read a display row back out. The report grows two lists and
  leaves one out where the project ran none.
- **HTML export.** JSON needs a reader and Markdown needs a renderer, so
  neither is something to open or send on. One file with its styles inline,
  following the reader's light or dark preference. Everything written into it
  is escaped, because a transcript carries the markup and script tags that were
  discussed inside the session, and the ampersand pass runs first or it would
  re-encode the entities the later passes introduce. Body text is written into
  a pre-wrap block rather than parsed as markdown: a parser would be a second
  renderer to keep in step with the app's own.
- **Worktrees read as the repository they belong to.** A branch checked out
  beside the main tree is its own folder, so every reader recorded it as a
  separate project and one repository listed twice. A linked worktree's `.git`
  is a file naming the repository that owns it, resolved once over the merged
  project list rather than in each of the nine readers, which all report a
  folder without knowing what owns it. Verified against a real `git worktree
  add`; not verified end to end, which would need recorded sessions inside a
  worktree.
- **Settings beyond Claude** (was item 13). The paths were hardcoded to
  `~/.claude`, and the plan's suggestion to drive them from `SPECS` did not
  survive contact: `SPECS` names MCP and rules files, not settings files, and
  `~/.claude/settings.json` is not in it at all. A surface map now names where
  each agent keeps its settings, and only Claude's is editable. That is not
  timidity: Gemini and OpenCode keep JSON of an entirely different schema, so
  writing `permissions.allow` into one would invent configuration the agent
  never asked for, and Codex and Grok are TOML. Four agents have no general
  settings file whatsoever and say so.
  A read-only surface still reports its path and what it holds, because which
  file carries a setting is the part that is hard to find. TOML is read by line
  scan for its outermost section names, no dependency added, because Codex
  writes a table per project and per plugin and the full paths listed hundreds
  of keys where the question is which areas the file configures.
  The refusal lives in the service, not only the view, so a request that
  reaches it directly is refused too. `readSettings`, `readScopeSettings` and
  `settingsPathFor` are gone: the map replaced all three, and keeping them
  would have been two mechanisms for one answer.
  The picker list lives in `config/agents`, not the service, because the view
  is client code and importing a value from a module that reads the filesystem
  pulled `node:fs/promises` into the browser bundle and blanked the app. The
  build did not catch it; hydration did. A test asserts the two lists name the
  same agents so they cannot drift.

## Phase 2: Agent tiers

- [x] Tier 1, history + management: Claude Code, Codex, GitHub Copilot, Cursor
      (+ Cursor Agent), OpenCode, Gemini CLI, Antigravity, Grok CLI.
- [x] Tier 2, management recorded but surfaced only once an adapter proves the
      surface: Cline/Roo/Kilo, Aider, Continue, Zed, Amazon Q, Goose, Qwen Code.
- [x] Tier 3, history only behind "More", no configuration code: the long-tail
      readers already built and covered.
- [x] Cline, Roo and Kilo read one session per task instead of three. The
      generic `files` walker took every `.json` in a task folder, so each task
      became three sessions sharing the id `api_conversation_history` and its
      own numeric project. Only the transcript is read; the task folder is the
      session and the extension folder is the project.
- [x] Cline drives tools with XML inside assistant text (`<list_files>`,
      `<execute_command>`, `<task_progress>`), which rendered as raw markup.
      `clineXmlUtils` splits a message into the prose it reads as and the calls
      it made, then hands each to the shared `parseToolInput`, so a Cline tool
      row is built by the same code as everyone else's and unknown tools land
      on the existing `generic` shape. The known names are a list rather than
      "any tag" because prose and code samples carry angle brackets too.
      `task_progress` becomes todos whether it arrives standalone or nested,
      because Cline writes it both ways. Verified against the one real store on
      the dev machine: 29 tool blocks and 18 text blocks out of one session
      that previously had no tool calls at all.
- [x] Antigravity desktop is read. The note this replaces was wrong twice over:
      the `.pb` needs no decryption and no `.proto`, and `state.vscdb` /
      `trajectorySummaries` is not the only plaintext mirror. A session's own
      artifacts under `~/.gemini/antigravity/brain/<id>/` are markdown
      (`task.md`, `implementation_plan.md`, `walkthrough.md`) and the first
      heading is its label, while `conversations/<id>.pb` carries its tool
      phrases as printable ASCII, so replacing every unprintable byte with a
      space and matching the phrases reads them without a schema.
      `antigravityDesktopUtils` merges into the existing three readers, so the
      desktop store is one more entry in `rootsUtils`.
      What it cannot give is a turn-by-turn transcript: the store keeps what a
      session produced, not the conversation that produced it, so a session
      reads as its task and its work. No desktop store exists on the dev
      machine, so this is unverified against real data by agreement.
- [ ] Blocked, no store to design against. Improve the generic SQLite reader's
      project model: `sqliteUtils` still falls back to `dirname(databasePath)`
      for the table decoder and for Zed, with no per-workspace split. This
      needs real Cursor/Zed/Goose stores to
      design against; none exist on the dev machine.

## Phase 3: Managed-agent registry

- [x] One source of truth for "can this agent be managed": a `SPECS` entry plus
      `capabilities.manage`. No parallel adapter list to keep in step.
- [x] Every Tier 1 surface has a spec and is managed: Claude, Codex, Copilot,
      Cursor, OpenCode, Gemini, Antigravity, Cursor Agent, Grok.
- [x] Model and auth configuration stays read-only and per-agent in
      `modelAuthUtils`, a switch over the format. Deliberately not abstracted.
- [x] Per-agent validators beyond Claude. A second one now exists, so
      `validateAgentSetup` takes the agent and the Health endpoint walks
      `managedAgents` for findings the same way it already walks them for
      setups. Codex earned it: `~/.codex/config.toml` declares MCP servers by
      command, and a command that is gone or not executable is the same shape
      of defect as a missing Claude hook.
      Only an absolute command is checked. A bare name resolves through PATH
      and a relative one against a working directory Codex picks, so reporting
      either would be a finding nobody can act on. A server the config
      disabled, and one declared by `url` with no local binary, are both left
      alone. `[mcp_servers.<name>.env]` ends the server's own fields, so an
      env var is never read as though it were the command.
      Agents without a validator return nothing, which keeps the switch honest
      rather than inventing checks per agent.

## Phase 5: Claude plugin write actions

- [x] Write only through the CLI (`claude plugin install <plugin@marketplace>
      -s <scope> -y`, `enable`, `disable`). Never hand-edit the registry files;
      the CLI owns that state.
- [x] Spike: the desktop scripts grant `--allow-run=claude`, and installs pass
      `-y` because the desktop shell is never a TTY. UI wires enable and
      disable; install is available through the service layer.
- [x] Verified against the packaged app, not just `astro dev`. `deno desktop`
      compiles rather than runs, so the grants are baked into the binary and
      readable back out of it. `--allow-run=claude` covers the PATH-resolved
      absolute path `claudeCliUtils` spawns, and denies every other binary.
      `--allow-write` and `--allow-net` were missing, which broke archives,
      session mutation, settings writes, retention and update checks in the
      packaged app while leaving them working under `astro dev`, where Node has
      no permission model. Net is scoped to the release feed host and its
      redirect target.
- [x] The `standalone` listener is the app, not a stray. Recorded here as a
      bind that fails into two unhandled rejections, to be dropped by switching
      `@astrojs/node` to `middleware` mode. Both halves were wrong: it binds
      cleanly on `127.0.0.1`, logs nothing, and `deno desktop` points the
      webview at that port rather than calling the handler. Launched with
      `ASTRO_NODE_AUTOSTART=disabled` the app has zero windows, so `middleware`
      mode would have shipped a blank app.
      The real defect was that the port answered anyone: a cross-origin `POST`
      from `evil.example` to `/api/project-delete` returned 200, so any page
      the user had open could delete projects and sessions, rewrite settings,
      or drive `plugin-action` into the Claude CLI. `src/middleware.ts` now
      refuses a request whose `Origin` names another site, which is a header
      check rather than a token because the window and the server share one
      process. Verified against the packaged app: window renders, same-origin
      and origin-less requests pass, cross-origin ones get a 403.

## Phase 6: Plugin cost attribution

- [x] Attribute context cost to enabled plugins using `claude plugin details`.

## Structure follow-ups

- [x] Extract components that are actually reused out of feature `partials`
      folders. Nothing qualifies: 58 partials, and not one is imported outside
      the feature that owns it. Revisit the first time a second feature reaches
      for one, rather than moving files on the strength of the idea.
- [x] `updates/updateConfig.ts` folded into the `*Service` / `*Utils` convention
      as `updates/utils/updateConfigUtils.ts`.
- [x] Decide where ambient `types.ts` lives across `lib/services`. It stays at
      the service root, which is where both of them already are: `history` and
      `updates` each keep one, read as `'../types'` from inside the service and
      by path from outside. A `types.ts` is not a utils module, so moving it
      under `utils/` would bend the `*Utils` convention and rewrite 27 import
      sites to leave the code exactly as readable.
- [x] The lockfile carried a dependency refresh (zod, happy-dom, rolldown,
      es-toolkit, pnpm 12.1.0) that no phase asked for. It now sits in its own
      `chore` commit rather than riding along with feature work, and the part
      worth keeping landed: `typescript-eslint` resolves to a single 8.68.0.
