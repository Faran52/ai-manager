import { useEffect, useState } from 'react';

import { checkAgentInstalls, postAgentInstall } from '@lib/apis/apiClient';
import { toErrorMessage } from '@utils/errorUtils';

import type { AgentId } from '@config/agents';
import type { AgentInstallStatus } from '@lib/apis/contracts';

export interface AgentInstalls {
  // undefined while the initial check is still in flight, or if it failed.
  readonly agents: Partial<Record<AgentId, AgentInstallStatus>> | undefined;
  readonly checkError: string | null;
  readonly installingAgent: AgentId | null;
  readonly installError: string | null;
  // Resolves true on success, so a confirm dialog can close itself only then
  // and leave the error already rendered in the list open on a failure.
  readonly install: (agent: AgentId) => Promise<boolean>;
}

// Installed-ness is a fact about the machine, not the project, so this checks
// once on mount. A finished install re-checks: one can partially succeed.
export const useAgentInstalls = (): AgentInstalls => {
  const [agents, setAgents] = useState<Partial<Record<AgentId, AgentInstallStatus>>>();
  const [checkError, setCheckError] = useState<string | null>(null);
  const [installingAgent, setInstallingAgent] = useState<AgentId | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;

    const check = async (): Promise<void> => {
      try {
        const response = await checkAgentInstalls();

        if (live) {
          setAgents(response.agents);
        }
      }
      catch (cause) {
        if (live) {
          setCheckError(toErrorMessage(cause));
        }
      }
    };

    void check();

    return () => {
      live = false;
    };
  }, [nonce]);

  const install = async (agent: AgentId): Promise<boolean> => {
    setInstallingAgent(agent);
    setInstallError(null);

    try {
      await postAgentInstall({ agent });
      setNonce((value) => {
        return value + 1;
      });
      return true;
    }
    catch (cause) {
      setInstallError(toErrorMessage(cause));
      return false;
    }
    finally {
      setInstallingAgent(null);
    }
  };

  return {
    agents,
    checkError,
    installingAgent,
    installError,
    install,
  };
};
