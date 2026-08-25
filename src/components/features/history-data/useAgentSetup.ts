import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import { fetchAgentSetup } from '@lib/apis/apiClient';

import { runLoad } from './asyncResource';

import type { AgentSetupResponse } from '@lib/apis/contracts';
import type { AsyncResource, AsyncSnapshot } from './asyncResource';

const NONE: AgentSetupResponse = {
  setups: [],
  findings: [],
  usage: null,
  plugins: [],
  trust: {
    known: false,
    trusted: false,
    onboarded: false,
  },
};

export const useAgentSetup = (projectPath: string | null): AsyncResource<AgentSetupResponse> => {
  const [snapshot, setSnapshot] = useState<AsyncSnapshot<AgentSetupResponse>>({ status: 'loading' });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;

    void runLoad(
      async () => {
        return projectPath == null ? NONE : await fetchAgentSetup({ projectPath });
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
