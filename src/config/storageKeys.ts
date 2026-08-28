// localStorage keys shared between the inline boot script in `index.astro` and the
// React islands. The boot script runs before any bundle, so both sides must agree.
export const themeStorageKey = 'acm-theme';
export const accentStorageKey = 'acm-accent';
export const treeExpandedStateKey = 'acm-sidebar-tree-expanded';
