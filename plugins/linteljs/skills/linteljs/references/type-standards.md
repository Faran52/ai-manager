# Type and Code Standards

*Shipped verbatim into generated projects; this workspace's own copy lives under .claude/rules/*.

Load before any type tracing, code authoring, or test work.

What ESLint already enforces is not repeated here. `@linteljs/eslint-config` owns line length, quote
style, brace style, import order, filename and folder case, unused imports, and arrow-function
style, because a second copy of those rules in prose only rots. This file carries what a linter cannot
see.

Nothing here is framework-specific. How props are read, and whether reading them a particular way
severs reactivity, is the framework's own rule file: this one shipped React's answer to every
target, and following it in Solid or Vue produces a component that renders once and then silently
stops updating.

## Components

- Arrow function expressions only, including a framework's default export. Never a `function`
  declaration.
- One component per file, named after the file. A container wrapping a presenter is two files.
- Name a component for what it renders, never generically (`Screen`, `DetailsView`, `Wrapper`).
- No `console` except `warn` and `error`.

## Types

- Never `any`, `unknown`, or `Record<string, unknown>`.
  - Carve-out: `unknown` only at a genuinely dynamic boundary with no upstream type, and only in a
    shape that shows the narrowing. Three of those are a guard's input
    `(value: unknown): value is X`, the `JSON.parse` payload it narrows, and a dynamic `import()`
    namespace. It must narrow before use. If an upstream type exists, type the input instead.
  - The fourth is a **caught value**: `catch` binds `unknown` by language rule under
    `useUnknownInCatchVariables`, so a single-argument helper turning a throw into something
    readable, `(error: unknown): string`, has no other parameter type available. Granted for the
    names a throw conventionally carries (`error`, `cause`, `reason`) and for one argument only,
    because a caught value is the whole input or it is not this case. This is the one carve-out
    keyed on a name rather than a shape, for the reason that TypeScript gives a caught value no
    type of its own to key on.
- **No casts to satisfy a type, anywhere, including tests.** No `as X`, no `as unknown as X`, no
  `as never`. A type you can only satisfy with a cast means the fixture or the design is wrong.
  Casting to a bare generic parameter (`as T`) inside the generic that declares it is exempt.
- No `@ts-ignore`, `@ts-expect-error` or `eslint-disable` to get past a type.
- Never assume a type. Trace it through its consumers and the actual data flow. If tracing takes
  more than a minute, ask.
- Object shapes get named `interface` or `type` declarations, placed after the imports. No inline
  object type literals. No index signature where a union of known keys works.
- A derived shape comes from its owner: `ReturnType`, `Parameters`, a schema's inferred type, the
  store's own state type. A hand-written duplicate of a shape that already exists is a lying type
  waiting to drift out from under its source.
- `noUncheckedIndexedAccess` is on, so index access is `T | undefined`. Handle it; do not cast it
  away. Two parallel arrays walked by one index are a smell the compiler is surfacing, so fold them
  into one record.
- No alias or back-compat re-exports of a type or value. Import the canonical definition from its
  home.

## Comments

- A comment says **why**: the constraint that forced the code, the measurement behind a constant,
  the bug a guard prevents. If it restates the code, delete it.
- No em dashes, anywhere a comment can land. A colon or a comma carries the same turn; a hyphen
  covers the ranges and compounds an em dash is reached for instead.
- `//` for one or two lines.
- `/** */` JSDoc at three lines or more. `@linteljs/comment-delimiter` enforces both halves and
  fixes either direction, so this is a gate rather than a habit.
- Comments stay minimal either way. Length is not a virtue; the shortest comment that carries the reason wins.
- No comments in test files. The test name carries the meaning.

## Tests

Load `testing.md` before touching tests, mocks or test setup.
