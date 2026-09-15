import type {
  EnvEntry,
  ScopeSettings,
  SettingsPermissions,
} from '@services/settings/settingsService';

// The part of a scope file this screen edits, held apart from the file until saved.
export interface Draft {
  readonly permissions: SettingsPermissions;
  readonly env: readonly EnvEntry[];
}

// Takes a Draft so a parked edit is counted too. Reading the file instead had
// the tab say 0 beside a list saying 1.
export const managedCount = (source: Draft): number => {
  return source.permissions.allow.length
    + source.permissions.deny.length
    + source.permissions.ask.length
    + source.permissions.additionalDirectories.length
    + source.env.length;
};

export const draftOf = (scope: ScopeSettings): Draft => {
  return {
    permissions: scope.permissions,
    env: scope.env,
  };
};
