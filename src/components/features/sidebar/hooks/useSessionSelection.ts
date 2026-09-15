import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import { agentOption } from '@config/agents';

import type { SessionSummary } from '@services/history/historyService';

export interface SessionSelection {
  readonly active: boolean;
  readonly selectedPaths: readonly string[];
  readonly selectedSessions: readonly SessionSummary[];
  // The visible sessions whose agent lets them be deleted; the rest cannot be picked.
  readonly selectableSessions: readonly SessionSummary[];
  readonly allSelected: boolean;
  readonly enter: () => void;
  readonly exit: () => void;
  readonly toggle: (session: SessionSummary) => void;
  readonly toggleAll: () => void;
}

/*
 * Selection mode over the session list: which rows are picked for a bulk
 * action, and Escape to leave it. `paused` holds Escape back while a dialog
 * above the list owns that key.
 */
export const useSessionSelection = (
  sessions: readonly SessionSummary[],
  visibleSessions: readonly SessionSummary[],
  paused: boolean,
): SessionSelection => {
  const [active, setActive] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<readonly string[]>([]);

  const selectableSessions = useMemo(() => {
    return visibleSessions.filter((session) => {
      return agentOption(session.agent).canDelete;
    });
  }, [visibleSessions]);

  const selectedSessions = useMemo(() => {
    return sessions.filter((session) => {
      return selectedPaths.includes(session.filePath);
    });
  }, [selectedPaths, sessions]);

  const allSelected = selectableSessions.length > 0
    && selectableSessions.every((session) => {
      return selectedPaths.includes(session.filePath);
    });

  const exit = (): void => {
    setActive(false);
    setSelectedPaths([]);
  };

  useEffect(() => {
    if (!active || paused) {
      return undefined;
    }

    const cancel = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setActive(false);
        setSelectedPaths([]);
      }
    };

    window.addEventListener('keydown', cancel);

    return () => {
      window.removeEventListener('keydown', cancel);
    };
  }, [active, paused]);

  return {
    active,
    selectedPaths,
    selectedSessions,
    selectableSessions,
    allSelected,
    enter: () => {
      setActive(true);
    },
    exit,
    toggle: (session) => {
      setSelectedPaths((current) => {
        return current.includes(session.filePath)
          ? current.filter((filePath) => {
              return filePath !== session.filePath;
            })
          : [...current, session.filePath];
      });
    },
    toggleAll: () => {
      setSelectedPaths(allSelected
        ? []
        : selectableSessions.map((session) => {
            return session.filePath;
          }));
    },
  };
};
