*Shipped verbatim into generated projects.*

# React State Rules

Use this rule when adding or refactoring state that derives from or reacts to props, or when
removing a `useEffect`.

## Props

- **Destructure props in the signature.** A React component function re-runs on every render, so a
  destructured prop is re-read each time. This is the opposite of Solid and Vue, where the same
  line reads once and then freezes; do not carry the habit across. Never read `props.x` in the
  body of a React component.
- Never spread `{...props}` into a component. It makes the accepted prop set unknowable at the
  call site.

## Banned Patterns

- Do not call a `useState` setter synchronously inside a `useEffect` to sync, reset, or adjust
  state from props or other state (`@eslint-react/set-state-in-effect`). It renders twice and the
  first render shows stale output.
- Do not read or write `ref.current` during render (`react-hooks/refs`). Refs are touched in
  effects and event handlers only.
- Do not call a setter unconditionally during render; it loops forever
  (`react-hooks/set-state-in-render` flags the unconditional form).

## Sanctioned Hierarchy

Use the first option that fits. Do not reach for a lower one when a higher one works.

1. **Derive during render.** If a value is computable from props or state, compute it inline and
   store nothing.
2. **Reset all state with `key`.** To reset a whole subtree when an identity prop changes, pass
   `key={id}` from the parent. Use this only when a full reset is what you mean.
3. **Adjust some state with the previous-value pattern**, the sanctioned replacement for the
   banned effect:

   ```tsx
   const [prevX, setPrevX] = useState(x);

   if (x !== prevX) {
     setPrevX(x);
     setDerivedState(/* ... */);
   }
   ```

   The condition is what makes it valid; this form passes `set-state-in-render`.

## Rules

- Compare with the same identity the removed effect's dependency used: value equality for
  primitives, reference equality for objects and arrays. That preserves the original trigger.
- The during-render block adjusts state **only**. Side effects (network calls, timers,
  subscriptions, navigation, logging) stay in effects or event handlers and never run during
  render. Polling and other timer or IO work keeps its `useEffect`; hold the latest callback in a
  ref written from an effect, not from render.
- Declare previous-value state with the other `useState` calls, above the comparison that reads
  it. See `hooks-order.md`.
- Inlining branches into render counts toward `sonarjs/cognitive-complexity`. If it pushes the
  component over the limit, extract the pattern into a `use*` hook rather than raising the limit.

## Sources

- https://react.dev/learn/you-might-not-need-an-effect
- https://react.dev/reference/eslint-plugin-react-hooks/lints/set-state-in-effect
- https://react.dev/reference/eslint-plugin-react-hooks/lints/set-state-in-render
