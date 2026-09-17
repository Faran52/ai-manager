// localStorage keys shared between the inline boot script in `index.astro` and the
// React islands. The boot script runs before any bundle, so both sides must agree.
export const themeStorageKey = 'acm-theme';
// Absent means the reader has not chosen, so the system's own language decides.
export const languageStorageKey = 'ai-manager-language';
export const accentStorageKey = 'acm-accent';
export const fontSizeStorageKey = 'acm-font-size';
export const projectsPaneStorageKey = 'acm-projects-pane';
export const sidebarWidthStorageKey = 'acm-sidebar-width';
// Whether each sidebar column is open. Absent means it is.
export const projectsDrawerStorageKey = 'acm-projects-drawer';
export const sessionsListStorageKey = 'acm-sessions-list';
export const messageFiltersStorageKey = 'acm-message-filters';
// Unlike the columns above, absent means closed: the navigator is asked for.
export const messageNavigatorOpenStorageKey = 'acm-message-navigator-open';
export const messageNavigatorWidthStorageKey = 'acm-message-navigator-width';
// Whether the app looks for a release on launch. Absent means it does.
