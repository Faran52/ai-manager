import { useCallback } from 'react';

import { postPluginAction } from '@lib/apis/apiClient';

import type { InstalledPlugin } from '@services/agents/agentsService';

export type PluginToggle = (plugin: InstalledPlugin) => Promise<void>;

/*
 * PluginInventory renders the failure beside the row it belongs to, so the
 * rejection is left to propagate and only the reload is guaranteed here.
 */
export const usePluginToggle = (projectPath: string, reload: () => void): PluginToggle => {
  return useCallback(async (plugin: InstalledPlugin): Promise<void> => {
    try {
      await postPluginAction({
        projectPath,
        plugin: plugin.id,
        scope: plugin.scope,
        action: plugin.enabled ? 'disable' : 'enable',
      });
    }
    finally {
      reload();
    }
  }, [projectPath, reload]);
};
