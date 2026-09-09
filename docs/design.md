# Design

The rules this interface follows, the scales it is built from, and the components that already
exist. Read it before adding a screen or a component.

The reference implementation is the shell mock at `~/Desktop/ai-manager-shell.html`, twelve screens
covering Transcript, Navigator, File edits, Analytics, Analytics at agent scope, Archive, Health,
Plugins and the four Settings surfaces. Where the mock and a rule below disagree, the rule wins:
the mock is static HTML and carries compromises the build does not have to.

## The rules

Each of these was settled by a specific problem in the shipped app. The reason matters more than
the rule, because the reason is what tells you when the rule does not apply.

**Scope reads left, actions read right, and never the reverse.** The command bar names what you are
looking at on one side and what you can do to it on the other. A control that moves sides changes
meaning.

**A figure appears only if the thing records it. Nothing prints a dash.** The Health table put nine
agents against four numeric columns, and five of them showed three dashes each: four columns
holding one number. An agent that records no MCP servers prints no MCP chip. A dash cannot
distinguish "records nothing" from "recorded zero", so it is never the answer.

**Success is silence, so only failures take a colour.** Seven green checks in a column say nothing.
Attention belongs to the two rows that need it.

**One row form for everything ranked: label, bar on a shared baseline, figure.** The app previously
drew four shapes for one idea: bars under their labels, bars beside them, columns, and stretched
blocks. They are all "name, magnitude, figure".

**A figure that is really two figures gets two columns, not a middot.** `19 sessions · $1,204.18`
right-aligned as one string lines up only its second half. Each figure gets a column and lines up
down it.

**Label and figure take only the width they need. The bar takes the rest.** Fixed side columns
sized for the longest content anywhere leave dead strips in every card that does not have it. The
bar track must still be identical on every row of a card, or the bars stop being comparable.

**Two promoted actions and an overflow, never a bar of greyed-out buttons.** Capability varies by
agent (`canDelete`, `canRename`, `canDeleteProject`). An action the agent cannot do is absent, not
disabled.

**Icons in the leading gutter, state on the trailing edge.** A left teal bar means "where you are",
navigation selection. A trailing check means "what it is set to", a menu value. They are different
questions and never share a side.

**Scope is always a pair, project and agent, and no control drops both halves at once.** The old
Global button dropped the project cards, and the agent branch lived on those cards, so it dropped
the agent too. What came back was every agent summed into one cost figure.

**A project card offers agent branches only where the view is scoped to an agent.** That is Sessions
and Analytics. Health takes a project path (`useAgentSetup`) and Archive takes nothing
(`useArchives`), so a branch there offers a scope the view cannot honour.

**Every funnel is the same menu: Filter by, a rule, Order by.** Filtering narrows the list on which
the funnel sits. It never changes what the pane is about. Scope controls live elsewhere for exactly
that reason.

**Depth is `--recess`, not black.** An inset shadow in `#000` reads as a hole punched in a warm
grey interface.

## Colour

Tokens live in `src/styles/tokens.css` and are role-named, deliberately compatible with shadcn
naming so a headless kit drops in without a re-theme. The file says so on line 1.

**No raw hex outside `tokens.css`.** The mock uses 46 distinct hex values; the build must not.

Both gaps below are now closed; the tables stay because they record where each step came from.

### The text ramp

`--foreground-2`, `--faint` and `--dim` now sit between `--foreground` and `--muted-foreground` in
`tokens.css`. The mock invented six steps between the two endpoints, and those six are the
most-used colours in the whole file:

| Mock hex  | Uses | Role                                             | Proposed token          |
|-----------|-----:|--------------------------------------------------|-------------------------|
| `#e8e6e3` |    1 | headings, the value in a metric                   | `--foreground` (exists) |
| `#d5d2ce` |    5 | session titles in a list                          | merge into `--foreground` |
| `#c6c3bf` |   27 | body text in menu rows, settings rows, card names | `--foreground-2`        |
| `#b4b1ad` |   13 | chips, list secondary text                        | merge into `--foreground-2` |
| `#9a9691` |    1 | (unused in the mock)                              | `--muted-foreground` (exists) |
| `#8d8a86` |   39 | figures beside a bar, tile labels                 | `--muted-foreground`    |
| `#7c7975` |    2 | counts inside a chip                              | merge into `--faint`    |
| `#6f6c67` |   47 | counts, hints, footnotes                          | `--faint`               |
| `#55524e` |   49 | column heads, paths, mono qualifiers              | `--dim`                 |
| `#4f4c48` |    2 | "no sessions", the least present true text        | merge into `--dim`      |
| `#3f3d3a` |    3 | an empty calendar cell outline                    | `--hair` (border, not text) |

Ten shades collapse to five. The merges are a judgement call and are listed as an open decision
below, but the count has to come down: eight near-identical greys are not a scale, they are drift.

### Two named surfaces

Both exist in `tokens.css`, in light and dark.

| Purpose                                     | Value     | Token |
|---------------------------------------------|-----------|----------------|
| Inset depth: bar tracks, pressed icon buttons | `#0d0e11` | `--recess`     |
| The border on a surface that floats above the pane: menus, modals, the settings sheet | `#3a3f47` | `--raised`     |

`--raised` is brighter than `--border` on purpose. A popup sharing the pane's border disappears
into it.

### Agent colours already exist. Use them.

`src/components/features/agent-tag/AgentTag.css` holds the palette: a `--agent-light` and
`--agent-dark` pair for all 29 agents in `AgentId`, keyed on `[data-agent]` so navigation can reuse
it, with `.project-provider-dot` already wired to the same variables. There is a neutral default
(`#52525b` / `#a1a1aa`) for an agent with no hue of its own.

The mock invented its own six-colour set (`--a-claude` and friends) and got Claude wrong: it is
amber in the app, not teal. **The mock's marks should adopt this palette; the palette should not
move to match the mock.** Twenty-nine agents also means a hue cannot be the only thing telling two
agents apart, so the mark always sits beside the name and never replaces it.

Agent colour is identity, never status. Status is `--ok`, `--warn` and `--destructive`, and per the
rule above only the last two are ever seen.

## Type

Two families, and the distinction carries meaning: **mono is a literal from a file** (a path, a
model id, a token count, a session id) and **sans is the app talking**. Do not use mono for
emphasis.

The mock uses fifteen sizes between 8.5px and 17px, in half-pixel steps. That is not a scale. The
mass sits in six places:

| Step   | Role                                                    |
|--------|---------------------------------------------------------|
| 9.5px  | column heads and eyebrow labels, uppercase, tracked      |
| 10.5px | mono figures, counts, hints, footnotes                   |
| 11.5px | body text, list rows, menu rows                          |
| 12.5px | primary UI text, names, the thing a row is about         |
| 14px   | card values, section titles                              |
| 17px   | the single largest metric value                          |

Everything else in the mock (8.5, 9, 13, 15, 16) is a stray and should be pulled to the nearest
step.

### Sizes are rem, not px

`[data-font-size]` sets a root percentage on `document.documentElement`, 87.5% for compact and
112.5% for large. `rem` scales with it. `px` does not.

The six steps are defined once in `global.css` as `--text-eyebrow`, `--text-figure`, `--text-body`,
`--text-ui`, `--text-value` and `--text-metric`, and used by name. The migration is finished:
`grep -r 'text-\[[0-9.]*px\]' src/` returns nothing, so Compact and Large reach every string in the
app rather than three fifths of them.

## Radius

| Radius | Use                                                          |
|--------|--------------------------------------------------------------|
| 4px    | small marks: checkboxes, the tiny tag on an archive row       |
| 5px    | a control nested inside another control                       |
| 7px    | controls: buttons, inputs, menu rows, icon buttons            |
| 9px    | surfaces: cards, panes, menus                                 |
| 11px   | the window frame and the pill-shaped chip, off-scale by intent |
| 50%    | agent marks and switch thumbs                                 |

`--radius` in `tokens.css` is `0.375rem`, which is 6px, and matches nothing in this scale. Pick one
and delete the other.

## Motion

**Motion is a feature here, not decoration, and it is held to the standard of a native macOS
surface.** There is no acceptable trade of smoothness for convenience. The vocabulary lives in
`src/components/ui/constants.ts` and nothing outside that file declares a duration or a curve.

| Transition           | Use                                        | Bounce |
|----------------------|--------------------------------------------|--------|
| `fadeTransition`     | opacity alone, content swapping in place   | n/a    |
| `riseTransition`     | a surface arriving: dialog, sheet, pane    | 0.14   |
| `popoverTransition`  | menus, popovers, tooltips                  | 0.04   |
| `collapseTransition` | disclosure: a row or drawer opening        | 0      |
| `controlTransition`  | a control answering a gesture: thumb, tab  | 0.2    |
| `fillTransition`     | a bar growing to its value                 | 0      |
| `foldTransition`     | a sidebar column folding to its mark strip | 0      |
| `drawerTransition`   | a companion pane sliding in beside the pane | 0     |

### The rules behind those numbers

**Springs, not eased durations, for anything interruptible.** A tween restarts from its curve when a
second gesture arrives mid-flight. That restart is the stutter that reads as cheap. A spring carries
its velocity through the interruption, which is what makes a macOS surface feel continuous rather
than replayed. The previous system used one expo-out curve for everything, and expo-out covers most
of its distance in the first tenth of the tween, which is why arrivals felt abrupt.

**Describe motion the way it is seen.** `visualDuration` is how long the movement looks like it
takes and `bounce` is overshoot from 0 to 1. Stiffness, damping and mass describe a simulation
nobody can picture.

**A chart may never overshoot.** `fillTransition` has zero bounce, and that is not taste. A bar that
springs past its value displays a number the data does not support and then corrects. For the length
of the overshoot the chart is lying.

**Disclosure may never bounce either.** An overshooting height pushes every row below it past its
resting place, so one expanding card makes the whole list wobble.

**Animate transform and opacity. Nothing else.** Width, height, top and left are layout properties:
each frame reflows everything after them in the document. `BarRow` used to animate `width`, and an
analytics pane holds dozens of bars, so every frame relaid out the pane. It scales now. Where a
height animation is genuinely unavoidable, it is a disclosure of a single bounded region and it is
the exception that gets argued for, not assumed.

Two width folds are that exception, argued and accepted: `foldTransition` on a sidebar column and
`drawerTransition` on a companion pane. Each is one bounded region whose inner content is pinned to
a fixed size and clipped, so the animated box carries no reflow of its own and only its single
neighbour relayouts. Both are springs, so an interrupting click keeps its velocity, and both have
zero bounce, so the neighbour is never shoved past its rest. A disclosure row (`collapseTransition`,
a bounded height, zero bounce) is the other accepted exception: the rows below it slide down as it
opens, which is the behaviour a reader expects, not the wobble the bounce ban is about.

**Lists arrive in sequence.** `MOTION_STAGGER` between siblings, so the eye reads an order instead of
a flash. A stagger long enough to notice as waiting is too long.

**Everything honours `REDUCED_MOTION_QUERY`.** Exported from the same file. Reduced motion means the
end state without the travel, never a broken layout.

### Still to do

`AgentRow`, `ArchiveCard` and `WorkRhythm` still animate `height` and want a transform-based
disclosure or a measured, bounded region. `SidebarPane` now folds on `foldTransition` and
`MessageTimeline` scrolls on a `translateY`, so both have left the list. The mock's charts also want
their fills on entry: the heatmap cells, the by-hour columns and the calendar grid currently appear
at full value.

## Component principles

The rules at the top of this file govern screens. These govern every component in
`src/components/ui`, new and existing. They are not aspirational: a component that breaks one is a
bug, not a style preference.

**A role is a promise about the keyboard.** Writing `role="menu"` commits you to Up, Down, Home, End
and typeahead. `role="dialog"` with `aria-modal` commits you to trapping focus. `role="tab"` commits
you to arrow keys and a roving tabindex. Do not declare a role you have not implemented; the app has
shipped two of those already. This is the whole reason the headless primitives were taken.

**State the DOM can see, not just a class.** Every component exposes its state as a data attribute,
`data-state="open"`, `data-state="checked"`, `data-active`. Two reasons: the testing standard forbids
asserting on hashed class names, and styling from an attribute keeps the state in one place instead
of in a conditional string. Radix emits `data-state` already; hand-rolled components match it.

**Disabled is a last resort.** An action that cannot be taken is absent, not greyed out. Where
disabled is genuinely right (a switch mid-write, a button awaiting a response), it is momentary and
the component says why through `aria-disabled` plus visible text, never through opacity alone.

**Focus is always visible.** Every interactive element takes a ring from `--ring` on
`:focus-visible`. No component removes an outline without replacing it.

**Icon-only means tooltip, not `title`.** A control with no visible label carries a `Tooltip` and an
`aria-label`. The native `title` attribute is not an accessible name for this purpose: it waits about
a second, cannot be styled, and never appears for a keyboard user.

**Logical properties only.** `ps`/`pe`, `ms`/`me`, `inset-s`/`inset-e`, `text-start`/`text-end`.
Arabic is one of six shipped locales, so a physical `pl` is a bug in five of them.

**Motion comes from `constants.ts`.** Pick the named transition that matches the gesture. Never write
a duration or an easing array inside a component, and never animate without honouring
`REDUCED_MOTION_QUERY`.

**Sizes come from the scales.** The type ramp and the radius scale above. A component that needs a
size not on a scale is telling you the scale is wrong; fix the scale.

**Props are readonly and destructured in the signature.** No `{...props}` spreading: it makes the
accepted prop set unknowable at the call site, and for a primitive the accepted prop set is the
entire contract.

**A primitive holds no domain knowledge.** Nothing in `ui/` imports from `features/`, knows what an
agent is, or reads i18n for anything but its own chrome (a close button's label). A component that
needs a `ProjectSummary` belongs in `features/`.

The one carve-out is `AgentMark`. Agent identity is a cross-cutting visual: the `[data-agent]` hue
is a global CSS contract in `AgentTag.css`, `agentOption` is a `@config` lookup rather than a
`features/` import, and the same circle is drawn by the session list, its folded strip and the
transcript. One `AgentId` in and a `<span data-agent>` out is not the domain knowledge this rule
guards against.

### The keyboard contract per primitive

| Primitive | Role                     | Keys it must answer                                     |
|-----------|--------------------------|---------------------------------------------------------|
| Switch    | `switch`                 | Space, Enter                                            |
| Tabs      | `tablist` / `tab`        | Arrow start/end, Home, End, and Tab moves out not across |
| Tooltip   | `tooltip` on describedby | Shows on focus, Escape dismisses                        |
| Menu      | `menu` / `menuitem`      | Up, Down, Home, End, typeahead, Escape                  |
| Submenu   | `menuitem` + `menu`      | Arrow toward it opens, arrow away closes                |
| Dialog    | `dialog` + `aria-modal`  | Escape closes, Tab cycles inside, focus returns on close |

Arrow directions are logical, not physical: in Arabic the key that opens a submenu is the one
pointing toward it on screen. The primitives handle this; a hand-rolled one would not.

## Components

### Exist (26, in `src/components/ui`)

AgentMark, Badge, BarRow, Button, CodeBlock, CodeLine, ConfirmDialog, Disclosure, EmptyState,
MarkdownText, MenuCheckboxItem, MenuItem, MetricCard, Modal, OutputBlock, PaneDivider, PatchView,
PopupMenu, SectionHeader, Spinner, Switch, Tabs, TabsPanel, TextInput, Toast, Tooltip.

`Disclosure` is the one collapsible: a trigger and a height-animated region on `collapseTransition`,
reduced-motion aware. Thinking, the injected-context row and the tool card all open through it.
`OutputBlock` is a tool result shown inline under its label (the tool card is the only collapse),
with a Parsed / Raw switch when the body reads as Markdown. It replaced `TruncatedText`.

Check this list before building anything: the mock's tiles are `MetricCard`, its ranked rows are
`BarRow`, its switches are `Switch`, its funnel is `PopupMenu` plus `MenuCheckboxItem`.

`Switch`, `Tabs`, `Tooltip` and `Modal` are built on Radix primitives, which own the keyboard
contract, the focus trap and the portal. Everything visible is ours: Radix ships no styles.

`Modal` takes a `title` string, which becomes the dialog's accessible name through a visually hidden
`Dialog.Title`. It renders as a `span`, not the `h2` Radix defaults to, because every consumer draws
its own visible heading and two headings with the same text is one too many when navigating by
heading.

### Still missing (0)

The **menu** landed. `PopupMenu`, `MenuItem` and `MenuCheckboxItem` are replaced by
`ui/menu`: `Menu`, `MenuItem`, `MenuCheckboxItem`, `MenuRadioGroup`, `MenuSub`, `MenuLabel` and
`MenuSeparator`, all on Radix `dropdown-menu`. Radix owns the trigger, the positioning, the arrow
keys, typeahead and the submenu open intent. A right-click menu still anchors to a point: the
trigger becomes a zero-sized element parked at the cursor, so the positioning stays Radix's rather
than being hand-computed.

Only four call sites moved, not eight. The other four were the appearance pickers, and they stopped
being menus entirely: **`SegmentedControl`** (native radios in a fieldset, so the browser owns the
arrow keys and the single tab stop) now carries Theme, Text size and Updates, `AccentPicker` is a
row of swatches plus `<input type="color">`, and `LanguagePicker` is a native `<select>`.

Two notes on the migration, both worth keeping:

- Radix names a menu after its trigger through `aria-labelledby`, which wins over `aria-label`. A
  right-click menu's trigger is an invisible point with no text, so the label has to be set *and*
  the pointer to the trigger cleared, or the menu has no accessible name at all.
- A checkbox row keeps the menu open (`onSelect` is prevented) because a filter list is read as a
  set. A radio row closes it, because choosing an order is the end of the interaction.

What the headless kit was taken for, and what it has already closed:

- `Modal` declared `role="dialog"` and `aria-modal="true"` and handled Escape, but had **no focus
  trap**: Tab walked out into the page behind the settings sheet. Radix owns it now.
- `PopupMenu` declares `role="menu"` with **no arrow-key navigation**. Still open, see above.
- One `role="switch"` was hand-rolled inside `PluginInventory.tsx`. There is a `Switch` now.
- There was no `role="tab"` anywhere, though the app already switches Transcript, Navigator and
  File edits. There is a `Tabs` now.
- There was no tooltip, so icon-only buttons used the native `title` attribute in about ten files:
  roughly a second of delay, unstyleable, and invisible to a keyboard user. There is a `Tooltip`
  now, and those ten call sites still need moving onto it.

### Bespoke, and no kit ships them (14)

Icon rail, collapsible drawer and its collapsed strip, project card with agent branches, session
row, tool-call card, transcript turn, ranked-row card, activity heatmap, by-hour chart, agent health
card, plugin inventory row, archive bundle row, settings scope column, accent swatch.

This is the point: a component kit covers six of twenty and none of the product's identity.

## What can be enforced instead of remembered

The repo already carries the machinery, so prefer a rule that fails a build over a paragraph nobody
rereads:

- **No raw hex outside `tokens.css`**: a stylelint rule. `stylelint-config-standard` and
  `stylelint-config-recess-order` are already configured.
- **No arbitrary type sizes**: `eslint-plugin-better-tailwindcss` is already installed and can
  reject `text-[11px]`.
- **Logical properties only**, `ps`/`pe`/`ms`/`me` rather than `pl`/`pr`, because Arabic ships. Six
  locales exist (`en`, `ja`, `ko`, `ar`, `zh-CN`, `zh-TW`) and exactly one file currently uses an
  `rtl:` utility, so this needs a sweep as well as a rule.

## Settled

1. **`--radius` is the 4/5/7/9/11 scale**, named `--radius-xs` through `--radius-xl` in
   `tokens.css`, and the 6px `--radius` is gone. Surfaces moved from `rounded-xl` to `rounded-lg`,
   which is what 9px means. No arbitrary radius survives anywhere in `src/`.
2. **The type ramp is done.** The six rem steps exist as `--text-eyebrow` through `--text-metric`
   and there are now **zero** arbitrary px text sizes in `src/`. Compact and Large reach all of it.
   The paragraph above describing 79 frozen sizes described a state that no longer exists.
3. **The headless kit won.** The menu is Radix `dropdown-menu`, which brings arrow keys, typeahead,
   the submenu the funnel needs, and portalled positioning. See below.
4. **The shell is the mock's arrangement**: rail, projects drawer, session list, pane. Each list
   column folds to a 56px strip of its own marks, projects to the first letters of the folder name
   and sessions to the agent circle the row already carries, and the width a folded column gives up
   goes to the pane rather than to the column beside it. What a strip cannot carry is the second
   line of a row, so a project loses its path and a session its age and message count until the
   column is unfolded again.

## Open decisions

1. **The grey merges above.** Ten shades to five is proposed, not settled. The five names all exist
   in `tokens.css` already; what is unsettled is whether any mock shade still wants its own step.
2. **Light mode.** The mock is dark only.
3. **Empty, loading, error and focus states.** Not drawn for any of the twelve screens. The file
   edits panel carries all three because it inherited them from the board half it replaced; nothing
   else has been swept.
4. **Right-to-left.** Not drawn, and thin in the code.

The board is settled: it is deleted. The mock removed the Transcript / Board / File edits strip
and never drew a board, and a grid of a whole project's sessions was a companion to no single one.
The Sessions view is the transcript alone now, with Navigator and File edits as panels beside it.

## Known gaps behind the mock

Screens that need service work before they can be built as drawn:

- `useProjectStats` takes no agent argument, so a filtered report is not possible yet.
- One agent across every project needs `computeGlobalStats` to keep the per-agent accumulator it
  already builds, instead of reducing it to `{ agent, tokens, sessions, projects }`.
- Health has no global mode: `useAgentSetup` is written around a project path.
- Archive has no project scope at all.
- `ScopeSettings.preservedKeys` is `readonly string[]`, so kept keys cannot show their values.
- `last active` is not on `ProjectStats`. Only `ProjectUsage.lastActiveMs` has it, and `activity`
  resolves to a day rather than an hour. The In / out tile is fine: `StatsTotals` already carries
  both figures.
- Reveal in Finder does not exist. It needs three OS labels, a widened `deno desktop` grant, and it
  belongs on the project's right-click menu rather than in Settings.

One thing found while inventorying and worth a decision of its own: the whole **Prompt history**
feature is written in `src/i18n/locales/en/session.json`, with scopes, search and an orphaned-prompts
list, and has zero references anywhere in `src/`. Either build it or delete the strings.
