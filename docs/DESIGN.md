# Design

The rules this interface follows, the scales it is built from, and the principles every component
answers to. Read it before adding a screen, a component, or any styling.

Each rule was settled by a specific problem in the shipped app, and the reason is recorded with it.
The reason matters more than the rule, because the reason is what tells you when the rule does not
apply.

## The rules

**Scope reads left, actions read right, and never the reverse.** The header names what you are
looking at on one side and what you can do to it on the other. A control that moves sides changes
meaning.

**A figure appears only if the thing records it. Nothing prints a dash.** The Health table once put
nine agents against four numeric columns and five of them showed three dashes each: four columns
holding one number. An agent that records no MCP servers prints no MCP chip. A dash cannot
distinguish "records nothing" from "recorded zero", so it is never the answer.

**Success is silence, so only failures take a colour.** Seven green checks in a column say nothing.
Attention belongs to the two rows that need it.

**One row form for everything ranked: label, bar on a shared baseline, figure.** The app once drew
four shapes for one idea: bars under their labels, bars beside them, columns, and stretched blocks.
They are all "name, magnitude, figure". `BarRow` is that form, and every ranked list in Analytics
goes through it.

**A figure that is really two figures gets two columns, not a middot.** `19 sessions · $1,204.18`
right-aligned as one string lines up only its second half. Each figure gets a column and lines up
down it.

**Label and figure take only the width they need. The bar takes the rest.** Fixed side columns sized
for the longest content anywhere leave dead strips in every card that does not have it. The bar
track must still be identical on every row of a card, or the bars stop being comparable.

**Two promoted actions and an overflow, never a bar of greyed-out buttons.** Capability varies by
agent (`canDelete`, `canRename`, `canDeleteProject`). An action the agent cannot do is absent, not
disabled.

**Icons in the leading gutter, state on the trailing edge.** A leading accent bar means "where you
are", which is navigation selection. A trailing check means "what it is set to", which is a menu
value. They are different questions and never share a side.

**Scope is always a pair, project and agent, and no control drops both halves at once.** An old
Global button dropped the project cards, and the agent branch lived on those cards, so it dropped
the agent too. What came back was every agent summed into one cost figure.

**A project card offers agent branches only where the view is scoped to an agent.** That is Sessions
and Analytics. Health takes a project path (`useAgentSetup`) and Archive scopes by project key
(`ArchiveSummary.projectKeys`), so an agent branch there offers a scope the view cannot honour.

**Every funnel is the same menu: Filter by, a rule, Order by.** Filtering narrows the list the
funnel sits on. It never changes what the pane is about. Scope controls live elsewhere for exactly
that reason.

**Depth is `--recess`, not black.** An inset shadow in `#000` reads as a hole punched through the
interface rather than a well in it.

## The window

**The title bar is the app's first row, not a strip above it.** `hiddenInset` runs the page to the
top of the window and leaves the traffic lights where macOS puts them, so the scope chip and the
search sit level with the buttons instead of below a band. The header reserves `80px` on the
physical left for them: physical because they stay left in Arabic, and `px` because they do not
scale with `[data-font-size]`. Both are deliberate exceptions to the logical-properties and rem
rules below.

**The header is the handle.** `.titlebar` is an `app-region: drag` surface and everything inside it
that answers a click is `no-drag`. A window with no bar and no drag region cannot be moved at all,
which is what the first attempt at this shipped.

**Where the platform draws a menu, the app does not.** macOS, and the Linux desktops that lift a
window menu into their panel, get a real menu bar holding About, Settings, the views and the editing
roles. Windows has no global bar, so the rail keeps its gear and the same entries hang off it. The
menu is described once by the page, in the reader's language, and only the surface differs.

**About is a window where the platform has one to give, a dialog where it does not.** One panel, two
frames, so nothing the app says about itself is written twice.

## Colour

Tokens live in `src/styles/tokens.css`, role-named and deliberately shadcn-compatible so a headless
kit drops in without a re-theme. **No raw hex outside that file.** The one carve-out is
`AgentTag.css`, which holds a `--agent-light` and `--agent-dark` pair per agent: those are identity,
not theme, and the rule below explains why they do not move.

The dark ramp is a blue-black, sampled from a reference screenshot rather than mixed by hand, so
every tone sits on one hue line (red, red plus four, red plus nine).

| Token                      | Dark      | What it is                                            |
|----------------------------|-----------|-------------------------------------------------------|
| `--background`, `--chrome` | `#13171c` | the canvas and the titlebar, which share a value       |
| `--sidebar`                | `#171b20` | the drawer, raised above the canvas, not set back into it |
| `--card`                   | `#1c2025` | anything floating on the canvas or inside the drawer   |
| `--popover`                | `#23272c` | menus and sheets, which float above cards              |
| `--muted`, `--secondary`   | `#282c31` | chips                                                  |
| `--accent`                 | `#2f3338` | hover                                                  |
| `--border`, `--input`      | `#373b40` | the edge that does the separating                      |
| `--hair`                   | `#262a2f` | a rule too soft to be a border: between transcript turns |
| `--raised`                 | `#484c51` | the border on a floating surface, brighter than `--border` so a menu does not vanish into the pane |
| `--recess`                 | `#0d1116` | inset depth: bar tracks, pressed controls              |
| `--code`                   | `#0f1318` | the surface under a command or a block of tool output  |

The drawer being lighter than the canvas is the one place this app departs from its reference. The
reference holds rows in its drawer; this app holds cards, and a card sharing the drawer's exact
value disappeared into it, so the card takes the next step up and the border carries the separation.

### The text ramp

Five steps, because four was not enough and ten was drift. Each one is a role, not a shade.

| Token                | Dark      | Role                                                  |
|----------------------|-----------|-------------------------------------------------------|
| `--foreground`       | `#e9edf2` | headings, the value in a metric                        |
| `--foreground-2`     | `#c5cbd2` | body text: menu rows, settings rows, card names        |
| `--muted-foreground` | `#949aa1` | figures beside a bar, tile labels                      |
| `--faint`            | `#757a80` | counts, hints, footnotes                               |
| `--dim`              | `#585d63` | column heads, paths, mono qualifiers                   |

### Accent and status are different things

`--primary` is the accent, and it is the reader's to change: six named swatches plus the system
colour picker. Because it can be anything, **nothing may depend on its hue to carry meaning.** It
colours selection, bars and active marks, all of which are also marked by position or shape.

Status is `--ok`, `--warn` and `--destructive`, and per the silence rule only the last two are
normally seen. These never move with the accent. `--ok` is teal even when the accent is not.

### Agent colours already exist. Use them.

`AgentTag.css` holds the palette, keyed on `[data-agent]` so navigation reuses it, with a neutral
default for an agent with no hue of its own. Agent colour is identity, never status, and twenty-nine
agents means a hue cannot be the only thing telling two apart: the mark always sits beside the name
and never replaces it.

## Type

Two families, and the distinction carries meaning: **mono is a literal from a file** (a path, a
model id, a token count, a session id) and **sans is the app talking**. Do not use mono for
emphasis.

Six steps, defined once in `global.css` and used by name. They are `rem`, never `px`, because
`[data-font-size]` sets a root percentage (87.5% compact, 112.5% large) and `rem` scales with it
while `px` does not.

| Token            | Role                                                 |
|------------------|------------------------------------------------------|
| `--text-eyebrow` | column heads and eyebrow labels, uppercase, tracked   |
| `--text-figure`  | mono figures, counts, hints, footnotes                |
| `--text-body`    | body text, list rows, menu rows                       |
| `--text-ui`      | primary UI text, names, the thing a row is about      |
| `--text-value`   | card values, section titles                           |
| `--text-metric`  | the single largest metric value                       |

## Radius

One scale, named for what a thing is rather than for a size.

| Token           | Size | Use                                                       |
|-----------------|------|-----------------------------------------------------------|
| `--radius-xs`   | 4px  | small marks: checkboxes, the tag on an archive row         |
| `--radius-sm`   | 5px  | a control nested inside another control                    |
| `--radius-md`   | 7px  | controls: buttons, inputs, menu rows, icon buttons         |
| `--radius-lg`   | 9px  | surfaces: cards, panes, menus                              |
| `--radius-xl`   | 11px | the window frame and the pill chip, off-scale by intent     |
| `50%`           |      | agent marks and switch thumbs                              |

No arbitrary radius belongs in `src/`. A `rounded-[7px]` is `rounded-md` written out by hand, and it
drifts back in with new components, so it is worth grepping for.

## Motion

**Motion is a feature here, not decoration, and it is held to the standard of a native macOS
surface.** There is no acceptable trade of smoothness for convenience. The vocabulary lives in
`src/components/ui/constants.ts` and nothing outside that file declares a duration or a curve. On
the CSS side, `--motion-fast` and `--motion-ease` in `tokens.css` are the same two facts for hover
and colour transitions, and Tailwind's default transition timing points at them, so no stylesheet
and no `duration-*` class writes its own milliseconds.

| Transition           | Use                                         | Bounce |
|----------------------|---------------------------------------------|--------|
| `fadeTransition`     | opacity alone, content swapping in place     | n/a    |
| `riseTransition`     | a surface arriving: dialog, sheet, pane      | 0.14   |
| `popoverTransition`  | menus, popovers, tooltips                    | 0.04   |
| `collapseTransition` | disclosure: a row or drawer opening          | 0      |
| `controlTransition`  | a control answering a gesture: thumb, tab    | 0.2    |
| `fillTransition`     | a bar growing to its value                   | 0      |
| `foldTransition`     | a sidebar column folding to its mark strip   | 0      |
| `drawerTransition`   | a companion pane sliding in beside the pane  | 0      |

`arriveInSequence(index)` is the list form: a staggered fade and a small settle, capped so a long
list does not become a queue. `MOTION_STAGGER` is the beat between siblings.

### The rules behind those numbers

**Springs, not eased durations, for anything interruptible.** A tween restarts from its curve when a
second gesture arrives mid-flight, and that restart is the stutter that reads as cheap. A spring
carries its velocity through the interruption, which is what makes a macOS surface feel continuous
rather than replayed.

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
analytics pane holds dozens of bars, so every frame relaid out the pane. It scales now.

Three exceptions are argued and accepted, not assumed. `foldTransition` on a sidebar column and
`drawerTransition` on a companion pane each animate one bounded region whose inner content is pinned
and clipped, so the animated box carries no reflow of its own and only its single neighbour
relayouts. A disclosure row (`collapseTransition`, bounded height, zero bounce) is the third: the
rows below it slide down as it opens, which is what a reader expects, not the wobble the bounce ban
is about. `ArchiveCard` still animates a raw `height` and wants a bounded, measured region instead.

**Everything honours `REDUCED_MOTION_QUERY`.** Reduced motion means the end state without the
travel, never a broken layout. The root `MotionConfig reducedMotion="user"` strips travel globally,
so an enter animation needs no per-site check; a hand-written `reduceMotion ? INSTANT : x` does, and
it needs a test with the `matchMedia` stub or its branches fall below the coverage gate.

## Component principles

The rules above govern screens. These govern every component in `src/components/ui`. They are not
aspirational: a component that breaks one is a bug, not a style preference.

**A role is a promise about the keyboard.** Writing `role="menu"` commits you to Up, Down, Home, End
and typeahead. `role="dialog"` with `aria-modal` commits you to trapping focus. `role="tab"` commits
you to arrow keys and a roving tabindex. Do not declare a role you have not implemented; the app
shipped two of those before the headless primitives were taken, which is the whole reason they were.

**State the DOM can see, not just a class.** Every component exposes its state as a data attribute:
`data-state="open"`, `data-state="checked"`, `data-active`. The testing standard forbids asserting
on hashed class names, and styling from an attribute keeps the state in one place instead of in a
conditional string. Radix emits `data-state` already; hand-rolled components match it.

**Disabled is a last resort.** An action that cannot be taken is absent, not greyed out. Where
disabled is genuinely right (a switch mid-write, a button awaiting a response) it is momentary, and
the component says why through `aria-disabled` plus visible text, never through opacity alone.

**Focus is always visible.** Every interactive element takes a ring from `--ring` on
`:focus-visible`. No component removes an outline without replacing it.

**Icon-only means tooltip, not `title`.** A control with no visible label carries a `Tooltip` and an
`aria-label`. The native `title` attribute is not an accessible name for this purpose: it waits
about a second, cannot be styled, and never appears for a keyboard user. This applies to a
truncation hint on text as much as to an icon button.

**Logical properties only.** `ps`/`pe`, `ms`/`me`, `inset-s`/`inset-e`, `text-start`/`text-end`.
Arabic is one of six shipped locales, so a physical `pl` is a bug in five of them.

**Motion comes from `constants.ts`.** Pick the named transition that matches the gesture. Never
write a duration or an easing array inside a component.

**Sizes come from the scales.** A component that needs a size not on a scale is telling you the
scale is wrong; fix the scale.

**A display icon sits on a plate.** Chrome icons are Lucide at 14 to 16px in a text colour. An empty
state is not chrome, and three attempts at fixing it failed the same way: a bigger icon, then a
thinner stroke, then purpose-drawn 48-grid glyphs. A grey hairline at 40px is a wireframe floating in
space whoever drew it. What reads is colour and a surface, so the icon goes at 44px inside an 80px
`rounded-xl` plate tinted `--primary` at 15%, which is the one place that radius is used for
something other than the window frame and the pill chip. `EmptyState` owns that footprint: a call
site passes an icon and never a size. A view that failed to load takes the error tone, because empty is not a
failure and is not coloured like one.

**Props are readonly and destructured in the signature.** No `{...props}` spreading: it makes the
accepted prop set unknowable at the call site, and for a primitive the accepted prop set is the
entire contract.

**A primitive holds no domain knowledge.** Nothing in `ui/` imports from `features/`, knows what an
agent is, or reads i18n for anything but its own chrome. A component that needs a `ProjectSummary`
belongs in `features/`.

The one carve-out is `AgentMark`. Agent identity is a cross-cutting visual: the `[data-agent]` hue is
a global CSS contract, `agentOption` is a `@config` lookup rather than a `features/` import, and the
same circle is drawn by the session list, its folded strip and the transcript. One `AgentId` in and
a `<span data-agent>` out is not the domain knowledge this rule guards against.

### The keyboard contract per primitive

| Primitive | Role                     | Keys it must answer                                      |
|-----------|--------------------------|----------------------------------------------------------|
| Switch    | `switch`                 | Space, Enter                                              |
| Tabs      | `tablist` / `tab`        | Arrow start/end, Home, End, and Tab moves out not across  |
| Tooltip   | `tooltip` on describedby | Shows on focus, Escape dismisses                          |
| Menu      | `menu` / `menuitem`      | Up, Down, Home, End, typeahead, Escape                    |
| Submenu   | `menuitem` + `menu`      | Arrow toward it opens, arrow away closes                  |
| Dialog    | `dialog` + `aria-modal`  | Escape closes, Tab cycles inside, focus returns on close   |

Arrow directions are logical, not physical: in Arabic the key that opens a submenu is the one
pointing toward it on screen. The primitives handle this; a hand-rolled one would not.

Two notes worth keeping from the Radix migration. Radix names a menu after its trigger through
`aria-labelledby`, which wins over `aria-label`, so a right-click menu anchored to an invisible
point has to set the label *and* clear the pointer to the trigger or it has no accessible name at
all. And a checkbox row keeps the menu open (`onSelect` prevented) because a filter list is read as a
set, while a radio row closes it, because choosing an order is the end of the interaction.

## Components

The primitives are whatever `src/components/ui/index.ts` exports. Read the barrel rather than a list
here, which goes stale the first time one lands.

What a kit does not cover is the point. These are bespoke and no headless library ships them: the
icon rail, the collapsible drawer and its collapsed strip, the project card with agent branches, the
session row, the tool-call card, the transcript turn, the ranked-row card, the activity heatmap, the
by-hour chart, the agent health card, the plugin inventory row, the archive bundle row, the settings
scope column and the accent swatch. A component kit covers the generic third of this interface and
none of its identity.

A partial stays in the feature that owns it until a second feature reaches for it. Moving a file on
the strength of the idea is how `ui/` fills up with things one screen uses.

## What can be enforced instead of remembered

Prefer a rule that fails a build over a paragraph nobody rereads. The repo already carries the
machinery:

- **No raw hex outside `tokens.css`**, as a stylelint rule. `stylelint-config-standard` and
  `stylelint-config-recess-order` are configured, and `color-hex-length` already normalises `#111111`
  to `#111`.
- **No arbitrary type sizes.** `eslint-plugin-better-tailwindcss` is installed and can reject
  `text-[11px]`. There are currently zero in `src/`.
- **No arbitrary radius**, the same way, for the same reason.
- **Logical properties only.** Six locales ship (`en`, `ja`, `ko`, `ar`, `zh-CN`, `zh-TW`) and only
  four files currently reach for an `rtl:` utility, so this wants a sweep as well as a rule.
