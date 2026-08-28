import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  ListTree,
  Search,
  X,
} from 'lucide-react';

import { buildTimelineModel } from '../utils/timelineUtils';

import type { HistoryEntry } from '@services/history/historyService';
import type { FC } from 'react';
import type { MessageFilters } from '../utils/messageFilterUtils';

export interface MessageNavigatorProps {
  readonly entries: readonly HistoryEntry[];
  readonly filters: MessageFilters;
  readonly width: number;
  readonly onNavigate: (index: number) => void;
  readonly onClose: () => void;
}

interface NavigatorEntry {
  // Row position, separators included, because that is what the timeline scrolls to.
  readonly index: number;
  // Position among messages alone, because that is what the reader is counting.
  readonly position: number;
  readonly kind: HistoryEntry['kind'];
  readonly key: string;
  readonly preview: string;
}

const cleanPreview = (text: string): string => {
  return text.replace(/\s+/gu, ' ').trim();
};

const previewOf = (entry: HistoryEntry): string => {
  switch (entry.kind) {
    case 'user':
      return cleanPreview([entry.text, entry.command, entry.injectedText].find((value) => {
        return value != null && value.length > 0;
      }) ?? '');
    case 'assistant': {
      const block = entry.blocks.find((item) => {
        return item.blockType === 'text' || item.blockType === 'tool-use';
      });

      if (block?.blockType === 'text') {
        return cleanPreview(block.text);
      }

      return block?.blockType === 'tool-use' ? block.call.name : '';
    }
    case 'system':
    case 'summary':
      return cleanPreview(entry.text);
  }
};

export const MessageNavigator: FC<MessageNavigatorProps> = ({
  entries,
  filters,
  width,
  onNavigate,
  onClose,
}) => {
  const { t } = useTranslation('session');
  const [filter, setFilter] = useState('');
  const rows = useMemo(() => {
    // Two numbers per message: where the timeline scrolls to, and what the
    // reader counts. Separators land in the first and not the second.
    const messages = buildTimelineModel(entries, filters).rows.flatMap((row, index) => {
      return row.kind === 'date'
        ? []
        : [{
            row,
            index,
          }];
    });

    return messages.map<NavigatorEntry>((message, position) => {
      return {
        index: message.index,
        position: position + 1,
        kind: message.row.entry.kind,
        key: message.row.key,
        preview: previewOf(message.row.entry),
      };
    });
  }, [entries, filters]);
  const needle = filter.trim().toLowerCase();
  const visibleRows = needle.length === 0
    ? rows
    : rows.filter((row) => {
        return row.preview.toLowerCase().includes(needle)
          || t(row.kind).toLowerCase().includes(needle);
      });

  return (
    <aside
      className="flex h-full shrink-0 flex-col bg-card/55"
      style={{ width }}
      aria-label={t('messageNavigator')}
      data-message-navigator
    >
      <header className="
        flex min-h-11 shrink-0 items-center gap-2 border-b border-border px-3
      "
      >
        <ListTree className="size-3.5 text-primary" />
        <h3 className="
          min-w-0 flex-1 truncate text-xs font-semibold text-foreground
        "
        >
          {t('messageNavigator')}
        </h3>
        <span className="
          font-mono text-[10px] text-muted-foreground tabular-nums
        "
        >
          {visibleRows.length}
        </span>
        <button
          type="button"
          className="
            rounded-md p-1 text-muted-foreground
            hover:bg-accent hover:text-foreground
          "
          aria-label={t('closeMessageNavigator')}
          onClick={onClose}
        >
          <X className="size-3.5" />
        </button>
      </header>
      <label className="relative m-2 mb-1.5 block shrink-0">
        <Search className="
          absolute inset-s-2.5 top-1/2 size-3 -translate-y-1/2
          text-muted-foreground
        "
        />
        <input
          type="text"
          value={filter}
          onInput={(event) => {
            setFilter(event.currentTarget.value);
          }}
          aria-label={t('searchMessageNavigator')}
          placeholder={t('searchMessageNavigator')}
          className="
            h-8 w-full rounded-md bg-muted ps-8 pe-2.5 text-xs text-foreground
            outline-none
            focus:ring-1 focus:ring-ring
          "
        />
      </label>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {visibleRows.length === 0
          ? (
              <p className="px-2 py-8 text-center text-xs text-muted-foreground">
                {t('noNavigatorMessages')}
              </p>
            )
          : (
              <ol className="space-y-0.5">
                {visibleRows.map((row) => {
                  return (
                    <li key={row.key}>
                      <button
                        type="button"
                        className="
                          group flex w-full gap-2 rounded-lg p-2 text-start
                          hover:bg-accent
                          focus-visible:outline-2 focus-visible:outline-ring
                        "
                        aria-label={`${t(row.kind)} ${String(row.position)}`}
                        onClick={() => {
                          onNavigate(row.index);
                        }}
                      >
                        <span className="
                          mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/70
                          group-hover:bg-primary
                        "
                        />
                        <span className="min-w-0 flex-1">
                          <span className="
                            flex items-center gap-1.5 font-mono text-[9px]
                            tracking-wide text-muted-foreground uppercase
                          "
                          >
                            <span>{String(row.position).padStart(2, '0')}</span>
                            <span>{t(row.kind)}</span>
                          </span>
                          <span className="
                            mt-0.5 line-clamp-2 text-[11px]/4 text-foreground/85
                          "
                          >
                            {row.preview || t(row.kind)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
      </div>
    </aside>
  );
};
