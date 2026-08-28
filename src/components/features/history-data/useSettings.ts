import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import { fetchSettings } from '@lib/apis/apiClient';

import { runLoad } from './asyncResource';

import type { ScopeSettings } from '@services/settings/settingsService';
import type { AsyncResource, AsyncSnapshot } from './asyncResource';

export const useSettings = (
  projectPath: string | null,
): AsyncResource<readonly ScopeSettings[]> => {
  const [snapshot, setSnapshot] = useState<AsyncSnapshot<readonly ScopeSettings[]>>({ status: 'loading' });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (projectPath == null) {
      return undefined;
    }

    let active = true;

    void runLoad(
      async () => {
        return (await fetchSettings({ projectPath })).scopes;
      },
      (next) => {
        if (active) {
          setSnapshot(next);
        }
      },
    );

    return () => {
      active = false;
    };
  }, [nonce, projectPath]);

  const reload = useCallback(() => {
    setNonce((value) => {
      return value + 1;
    });
  }, []);

  return {
    ...snapshot,
    reload,
  };
};
