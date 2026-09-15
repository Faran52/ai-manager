import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  ListTree,
  Search,
  X,
} from 'lucide-react';

import { agentBadgeLabel } from '@config/agents';

import { cn } from '@utils/cnUtils';

import { previewOf } from '../utils/navigatorUtils';
import { buildTimelineModel } from '../utils/timelineUtils';

import type { AgentId } from '@config/agents';
import type { HistoryEntry } from '@services/history/historyService';
import type { FC } from 'react';
import type { MessageFilters } from '../utils/messageFilterUtils';

export interface MessageNavigatorProps {
  readonly entries: readonly HistoryEntry[];
  // The session's agent, so an assistant row reads in its hue and by its name,
  // the way the session list marks it.
  readonly agent: AgentId;
  // Which sibling root the session came from, so the name carries the same
  // qualifier the session list badge does.
  readonly profile?: string | undefined;
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

export const MessageNavigator: FC<MessageNavigatorProps> = ({
  entries,
  agent,
  profile,
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
        const label = row.kind === 'assistant' ? agentBadgeLabel(agent, profile) : t(row.kind);

        return row.preview.toLowerCase().includes(needle)
          || label.toLowerCase().includes(needle);
      });

  return (
    <aside
      className="
        flex h-full shrink-0 flex-col border-s border-border bg-background
      "
      style={{ width }}
      aria-label={t('messageNavigator')}
      data-message-navigator
    >
      <header className="
        flex min-h-11 shrink-0 items-center gap-2 border-b border-border px-3
      "
      >
        <ListTree className="size-3.5 text-faint" />
        <h3 className="
          min-w-0 flex-1 truncate text-xs font-semibold text-foreground
        "
        >
          {t('navigator')}
        </h3>
        <span className="
          font-mono text-figure text-muted-foreground tabular-nums
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
              <ol className="space-y-px">
                {visibleRows.map((row) => {
                  // The assistant reads by its agent's name and hue, the way the
                  // session list marks it; every other kind keeps its plain word.
                  const roleLabel = row.kind === 'assistant'
                    ? agentBadgeLabel(agent, profile)
                    : t(row.kind);

                  return (
                    <li key={row.key}>
                      <button
                        type="button"
                        className="
                          flex w-full gap-2.5 rounded-md px-2.5 py-1.5
                          text-start
                          hover:bg-accent
                          focus-visible:outline-2 focus-visible:outline-ring
                        "
                        aria-label={`${roleLabel} ${String(row.position)}`}
                        onClick={() => {
                          onNavigate(row.index);
                        }}
                      >
                        {/* The count in its own column, the way the mock keeps
                            the number small beside a two-line preview. */}
                        <span className="
                          mt-px w-4 shrink-0 font-mono text-figure text-dim
                          tabular-nums
                        "
                        >
                          {String(row.position).padStart(2, '0')}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="
                            mb-0.5 flex items-center gap-1.5 text-eyebrow
                            font-semibold tracking-wide text-muted-foreground
                            uppercase
                          "
                          >
                            {/* The role reads as colour, the same question the
                                session list answers with the agent circle. */}
                            {row.kind === 'assistant'
                              ? (
                                  <span
                                    data-agent={agent}
                                    className="
                                      agent-dot size-1.5 shrink-0 rounded-full
                                    "
                                  />
                                )
                              : (
                                  <span className={cn(
                                    'size-1.5 shrink-0 rounded-full',
                                    row.kind === 'user'
                                      ? 'bg-muted-foreground'
                                      : 'bg-primary/70',
                                  )}
                                  />
                                )}
                            {roleLabel}
                          </span>
                          <span className="
                            line-clamp-2 text-body/snug text-foreground-2
                          "
                          >
                            {row.preview || roleLabel}
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
