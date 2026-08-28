// Shared so the handler and the cheat sheet cannot drift apart.
export interface ShortcutSpec {
  readonly key: string;
  readonly meta?: boolean;
  readonly shift?: boolean;
}

export type ShortcutId
  = | 'openSearch'
    | 'viewSessions'
    | 'viewAnalytics'
    | 'viewHealth'
    | 'reload'
    | 'toggleNavigator'
    | 'showShortcuts';

export const appShortcuts: Record<ShortcutId, ShortcutSpec> = {
  openSearch: { key: '/' },
  viewSessions: { key: '1' },
  viewAnalytics: { key: '2' },
  viewHealth: { key: '3' },
  reload: { key: 'r' },
  toggleNavigator: {
    key: 'm',
    meta: true,
    shift: true,
  },
  showShortcuts: {
    key: '?',
    shift: true,
  },
};

export const shortcutOrder: readonly ShortcutId[] = [
  'openSearch',
  'showShortcuts',
  'viewSessions',
  'viewAnalytics',
  'viewHealth',
  'reload',
  'toggleNavigator',
];
