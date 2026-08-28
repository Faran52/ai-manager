import {
  useCallback,
  useRef,
  useState,
} from 'react';

import { fetchSearch } from '@lib/apis/apiClient';
import { toErrorMessage } from '@utils/errorUtils';

import type { SearchResponse } from '@lib/apis/contracts';

type SearchPhase = 'idle' | 'loading' | 'ready' | 'error';

export interface SearchController {
  readonly phase: SearchPhase;
  readonly query: string;
  readonly outcome: SearchResponse | undefined;
  readonly error: string | undefined;
  readonly run: (query: string, projectId: string | null) => void;
}

export const useSearch = (): SearchController => {
  const [phase, setPhase] = useState<SearchPhase>('idle');
  const [query, setQuery] = useState('');
  const [outcome, setOutcome] = useState<SearchResponse | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const sequenceRef = useRef(0);

  const run = useCallback((nextQuery: string, projectId: string | null): void => {
    const ticket = sequenceRef.current + 1;

    sequenceRef.current = ticket;
    setPhase('loading');
    setQuery(nextQuery);
    setError(undefined);

    void (async (): Promise<void> => {
      try {
        const result = await fetchSearch({
          query: nextQuery,
          projectId: projectId ?? undefined,
        });

        if (sequenceRef.current !== ticket) {
          return;
        }

        setPhase('ready');
        setOutcome(result);
      }
      catch (cause) {
        if (sequenceRef.current !== ticket) {
          return;
        }

        setPhase('error');
        setError(toErrorMessage(cause));
      }
    })();
  }, []);

  return {
    phase,
    query,
    outcome,
    error,
    run,
  };
};
