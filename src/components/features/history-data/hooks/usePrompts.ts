import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import { fetchPrompts } from '@lib/apis/apiClient';

import { runLoad } from '../utils/asyncResourceUtils';

import type { PromptHistory } from '@services/prompts/promptsService';
import type { AsyncResource, AsyncSnapshot } from '../utils/asyncResourceUtils';

export const usePrompts = (enabled: boolean): AsyncResource<PromptHistory> => {
  const [snapshot, setSnapshot] = useState<AsyncSnapshot<PromptHistory>>({ status: 'loading' });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let active = true;

    void runLoad(
      async () => {
        return fetchPrompts();
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
  }, [enabled, nonce]);

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
