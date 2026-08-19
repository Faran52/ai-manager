*Shipped verbatim into generated projects.*

# Hooks Order

`react-hooks/rules-of-hooks` is enabled and enforces the invariants: unconditional, top level,
same order every render, custom hooks included. It cannot enforce a *readable* order, which is
what this file is for.

Keep components and custom hooks in one predictable shape, top to bottom:

1. Local state: `useState` / `useReducer`. State whose initialiser needs a derived value may sit
   just below that value, but still above anything that reads it during render.
2. Context, store and library hooks: `useContext`, `useQuery`, whatever navigation hook this
   project's router provides, custom `use*` hooks.
3. Derived values computed from props, state, or those hooks.
4. During-render state-adjustment blocks (see `react-state.md`).
5. `useCallback` / `useMemo` handlers.
6. `useEffect` blocks.

A conditional `setState` during render is not a conditional hook: the `if` guards the setter call,
not a `useState` or `useEffect` call. The hooks themselves stay unconditional.
