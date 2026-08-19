*Shipped verbatim into generated projects; this workspace's own copy lives under .claude/rules/*.

# Repository Structure

Use this rule when adding, moving, renaming, or importing a source file.

Filename case and folder case are enforced by `check-file` in `eslint.config.js`. They are not
restated here, because a prose copy of a lint rule is the part that rots. This file carries placement
and direction, which no rule can see.

A spec takes the name of the file it tests, whatever case that is. The naming rule deliberately
carries no glob for a spec: it mirrors a subject that is already policed, and a `.ts` spec of a
component judged by the rule meant for a module could satisfy neither. Match the file you are
testing.

## Layout

```
src/
  pages/          routes. The only router: a file here is a URL
  layouts/        page shells, wrapping a route's content
  components/
    ui/           primitives, reusable by nature
    features/     reusable domain features
  config/         constants and env access
  typings/        ambient .d.ts only
  content/        content collections, and their schema
  styles/         global.css and anything imported by a layout
  assets/
  lib/
    utils/        pure helpers, no domain type in the signature
    services/     domain logic, may never touch HTTP
    apis/         endpoint definitions and schemas
```

**`src/pages/` is the router.** A file there is a route, so its name is the URL: `about.astro` is
`/about`, `[slug].astro` is a dynamic segment, and `index.astro` is the directory's own path. Nothing
that is not a route belongs in it, which is the one thing this layout enforces that a lint rule
cannot.

`astro.config.mjs` is where the build lives. There is no `vite.config.ts`: Vite options go in this
file's `vite` key, and an integration is how a framework, an adapter or a sitemap arrives.

## Islands

A `.astro` component renders on the server and ships no JavaScript. A component written in the
hosted UI framework ships some, and only when a `client:*` directive says to.

- **Default to `.astro`.** Reach for a framework component when the thing genuinely needs state,
  effects or event handlers in the browser, not because it is the familiar way to write markup.
- A `client:` directive is a decision about the bundle. `client:load` hydrates immediately,
  `client:visible` waits for the viewport, `client:idle` waits for the main thread. Choosing one is
  choosing what the page costs.
- An island receives props once, serialised. It is not a place to pass a function, a class instance
  or anything else that does not survive JSON.
- Two islands are two roots: they share no state. Cross-island state belongs in `lib/`, in a store
  the framework layer's own rule file describes, or in the URL.

## Placement

- **Closest to its consumer.** A helper used by one page lives beside that page; it moves to
  `lib/utils/` the moment a second page needs it, not before and not after.
- **`lib/` is framework-free and server-safe.** No `Astro` global, no `client:` anything, no
  `document`. That is what makes it testable without rendering and reusable from a route handler.
- `layouts/` holds page shells. A layout that is only used by one page is that page's own markup.
- `components/ui/` takes anything reusable by nature even with one consumer today; a component bound
  to its parent's data lives in that parent's `partials/`, never nested deeper.
- Content collections live in `src/content/`, with their schema beside them. A collection's schema is
  the contract for its frontmatter, so it belongs with the content and not in `lib/`.

## Direction

Imports run one way: `pages → layouts → components → lib/services → lib/utils → config`.

- `config/*` imports only sibling config, assets, and third-party modules.
- `lib/*` does not import from `pages/`, `layouts/` or `components/`.
- `components/*` does not import from `pages/` or `layouts/`.
- One page does not import from another. Shared markup is a layout or a component.
- `tsconfig.json` is canonical for path aliases. Use the configured ones; never invent a shorthand
  and never write a `src/` prefix.
