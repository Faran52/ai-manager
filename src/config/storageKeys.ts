// localStorage keys shared between the inline boot script in `index.astro` and the
// React islands. The boot script runs before any bundle, so both sides must agree.
export const themeStorageKey = 'acm-theme';
export const accentStorageKey = 'acm-accent';
export const projectsPaneStorageKey = 'acm-projects-pane';
export const sidebarWidthStorageKey = 'acm-sidebar-width';
export const messageFiltersStorageKey = 'acm-message-filters';
export const messageNavigatorOpenStorageKey = 'acm-message-navigator-open';
export const messageNavigatorWidthStorageKey = 'acm-message-navigator-width';
