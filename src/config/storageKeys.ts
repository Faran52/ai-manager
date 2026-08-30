// localStorage keys shared between the inline boot script in `index.astro` and the
// React islands. The boot script runs before any bundle, so both sides must agree.
export const themeStorageKey = 'acm-theme';
// Absent means the reader has not chosen, so the system's own language decides.
export const languageStorageKey = 'ai-chat-manager-language';
export const accentStorageKey = 'acm-accent';
export const fontSizeStorageKey = 'acm-font-size';
export const projectsPaneStorageKey = 'acm-projects-pane';
export const sidebarWidthStorageKey = 'acm-sidebar-width';
export const messageFiltersStorageKey = 'acm-message-filters';
export const messageFilterBarStorageKey = 'acm-message-filter-bar';
export const messageNavigatorOpenStorageKey = 'acm-message-navigator-open';
export const messageNavigatorWidthStorageKey = 'acm-message-navigator-width';
