import {
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import { Search as SearchIcon } from 'lucide-react';

import { Modal } from '@ui/index';

import { groupBySession } from './hitGroups';

import type { SearchController } from '@features/history-data';
import type { SearchHit } from '@services/search/searchService';
import type { FC } from 'react';

export interface SearchDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly search: SearchController;
  readonly projectNames: ReadonlyMap<string, string>;
  readonly onJump: (hit: SearchHit) => void;
}

export const SearchDialog: FC<SearchDialogProps> = ({
  open,
  onClose,
  search,
  projectNames,
  onJump,
}) => {
  const { t } = useTranslation('common');
  const [term, setTerm] = useState('');
  const [prevOpen, setPrevOpen] = useState(open);
  const debounceRef = useRef<number | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const runSearch = search.run;

  if (open !== prevOpen) {
    setPrevOpen(open);

    if (!open) {
      setTerm('');
    }
  }

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    window.clearTimeout(debounceRef.current);

    const trimmed = term.trim();

    if (trimmed.length < 2) {
      return undefined;
    }

    debounceRef.current = window.setTimeout(() => {
      runSearch(trimmed, null);
    }, 250);

    return () => {
      window.clearTimeout(debounceRef.current);
    };
  }, [runSearch, term]);

  const groups = search.phase === 'ready' ? groupBySession(search.outcome?.hits ?? []) : [];
  const hasQuery = term.trim().length >= 2;

  return (
    <Modal open={open} onClose={onClose} labelledBy="search-dialog-title" widthClass="max-w-2xl">
      <div
        id="search-dialog-title"
        className="border-b border-border px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <SearchIcon className="size-4 text-muted-foreground" />
          <input
            ref={inputRef}
            data-search-input
            value={term}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchHistory')}
            onChange={(event) => {
              setTerm(event.currentTarget.value);
            }}
            className="
              w-full bg-transparent text-sm text-foreground outline-none
              placeholder:text-muted-foreground
            "
          />
        </div>
      </div>

      <div className="max-h-[55vh] overflow-y-auto p-2" data-search-results>
        {!hasQuery && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            Type at least two characters.
          </p>
        )}
        {hasQuery && search.phase === 'loading' && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">Searching…</p>
        )}
        {hasQuery && search.phase === 'error' && (
          <p className="px-3 py-6 text-center text-sm text-destructive">{search.error}</p>
        )}
        {groups.map((group) => {
          const projectName = projectNames.get(`${group.first.agent}:${group.first.projectId}`)
            ?? group.first.projectId;

          return (
            <div key={group.filePath} className="mb-2">
              <p className="
                truncate px-2 py-1 text-[11px] font-semibold tracking-wider
                text-muted-foreground uppercase
              "
              >
                {`${projectName} · ${new Date(group.first.timestampMs).toLocaleDateString('en-GB')}`}
              </p>
              {group.hits.map((hit, index) => {
                return (
                  <button
                    key={`${group.filePath}-${String(index)}`}
                    type="button"
                    onClick={() => {
                      onJump(hit);
                      onClose();
                    }}
                    data-search-hit
                    className="
                      w-full rounded-md px-2 py-1.5 text-start
                      hover:bg-accent
                    "
                  >
                    <span className="
                      mb-0.5 block text-[10px] tracking-wide
                      text-muted-foreground uppercase
                    "
                    >
                      {hit.role}
                    </span>
                    <span className="
                      block truncate text-xs text-muted-foreground
                    "
                    >
                      {hit.before}
                      <mark className="bg-primary/25 text-inherit">{hit.match}</mark>
                      {hit.after}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
        {hasQuery && search.phase === 'ready' && groups.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">No matches.</p>
        )}
      </div>
    </Modal>
  );
};
