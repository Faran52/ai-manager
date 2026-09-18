import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { clamp } from 'es-toolkit';
import {
  CircleAlert,
  FileText,
  GitBranch,
  ListTree,
  MessageSquare,
  Users,
} from 'lucide-react';

import { agentBadgeLabel, agentOption } from '@config/agents';
import { appShortcuts } from '@config/shortcuts';
import {
  messageFiltersStorageKey,
  messageNavigatorOpenStorageKey,
  messageNavigatorWidthStorageKey,
} from '@config/storageKeys';

import { cn } from '@utils/cnUtils';
import { isTypingTarget, matchesShortcut } from '@utils/shortcutUtils';

import {
  Button,
  EmptyState,
  IconButton,
  Loader,
  ScrollToEnd,
  storedWidth,
  useMinLoad,
  useSmoothScroll,
} from '@ui/index';
import { useMessages } from '@features/history-data';

import { LOAD_AHEAD_MARGIN } from './constants';
import { MessageTimeline } from './MessageTimeline';
import {
  CompanionPane,
  MAX_COMPANION_WIDTH,
  MessageFilterMenu,
  MIN_COMPANION_WIDTH,
} from './partials';
import {
  countVisibleEntries,
  decodeMessageFilters,
  encodeMessageFilters,
  hasActiveMessageFilters,
} from './utils/messageFilterUtils';

import type { AgentId } from '@config/agents';
import type { AsyncStatus } from '@features/history-data';
import type { EditedFile, FileEdit } from '@services/edits/editsService';
import type { HistoryEntry } from '@services/history/historyService';
import type { WidthRange } from '@ui/index';
import type { FC, ReactNode } from 'react';
import type { TimelineNavigation } from './MessageTimeline';
import type { CompanionPanel } from './partials';

export interface SessionViewerProps {
  readonly filePath: string | null;
  readonly agent?: AgentId | undefined;
  readonly profile?: string | undefined;
  readonly sessionTitle: string | undefined;
  // Named beside the project, since it says which line of work this session is on.
  readonly gitBranch?: string | undefined;
  readonly highlightTimestamp: string | undefined;
  readonly sourceModifiedMs?: number | undefined;
  // The edits this session made, shown beside it rather than in place of it.
  readonly editedFiles?: readonly EditedFile[] | undefined;
  readonly editsStatus?: AsyncStatus | undefined;
  readonly editsError?: string | undefined;
  readonly projectPath?: string | undefined;
  readonly nowMs?: number | undefined;
  readonly onOpenEdit?: ((edit: FileEdit) => void)
    | undefined;
  // Hands the loaded transcript up so the command bar can export it.
  readonly onEntriesLoaded?: ((entries: readonly HistoryEntry[]) => void)
    | undefined;
}

const COMPANION_WIDTH: WidthRange = {
  min: MIN_COMPANION_WIDTH,
  max: MAX_COMPANION_WIDTH,
  fallback: 280,
};

// The model the assistant last answered on, for the meta line. The transcript
// itself still marks a mid-session model switch turn by turn.
const modelOf = (entries: readonly HistoryEntry[]): string | undefined => {
  return entries.reduce<string | undefined>((found, entry) => {
    return entry.kind === 'assistant' && entry.model != null ? entry.model : found;
  }, undefined);
};

export const SessionViewer: FC<SessionViewerProps> = ({
  filePath,
  agent = 'claude',
  profile,
  sessionTitle,
  gitBranch,
  highlightTimestamp,
  sourceModifiedMs = 0,
  editedFiles = [],
  editsStatus = 'ready',
  editsError,
  projectPath,
  nowMs = 0,
  onOpenEdit,
  onEntriesLoaded,
}) => {
  const { t } = useTranslation('session');
  const [includeSidechain, setIncludeSidechain] = useState(false);
  const [filters, setFilters] = useState(() => {
    return decodeMessageFilters(localStorage.getItem(messageFiltersStorageKey));
  });
  const [panel, setPanel] = useState<CompanionPanel>(() => {
    return localStorage.getItem(messageNavigatorOpenStorageKey) === 'true' ? 'navigator' : 'none';
  });
  const [navigatorWidth, setNavigatorWidth] = useState(() => {
    return storedWidth(messageNavigatorWidthStorageKey, COMPANION_WIDTH);
  });
  const [navigation, setNavigation] = useState<TimelineNavigation | null>(null);
  const supportsSidechains = agentOption(agent).supportsSidechains === true;
  const feed = useMessages(
    filePath,
    agent,
    supportsSidechains && includeSidechain,
    sourceModifiedMs,
  );
  const waiting = useMinLoad(feed.phase === 'loading' && feed.entries.length === 0);
  // A callback ref, not useRef: a ref object is still null when the child mounts,
  // so nothing would re-render to hand the virtualizer its scroll element.
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  // The foot of the loaded rows, watched so the next page arrives before it does.
  const [endMarker, setEndMarker] = useState<HTMLDivElement | null>(null);
  const visibleEntries = countVisibleEntries(feed.entries, filters);
  const model = modelOf(feed.entries);
  const filtersActive = hasActiveMessageFilters(filters);
  const countLabel = filtersActive
    ? t('itemsShown', {
        visible: visibleEntries,
        total: feed.entries.length,
      })
    : t('itemsLoaded', { count: feed.entries.length });

  useSmoothScroll(scrollElement);

  /*
   * Scrolling toward the end loads the next page; the button below is a fallback.
   * A null root means the viewport, right for the render before the ref lands.
   */
  useEffect(() => {
    if (endMarker == null || !feed.hasMore) {
      return undefined;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting === true) {
        feed.loadMore();
      }
    }, {
      root: scrollElement,
      rootMargin: LOAD_AHEAD_MARGIN,
    });

    observer.observe(endMarker);

    return () => {
      observer.disconnect();
    };
  }, [endMarker, feed, scrollElement]);

  // The command bar's export menu reads the entries this viewer loaded.
  useEffect(() => {
    onEntriesLoaded?.(feed.entries);
  }, [feed.entries, onEntriesLoaded]);

  useEffect(() => {
    localStorage.setItem(messageFiltersStorageKey, encodeMessageFilters(filters));
  }, [filters]);

  useEffect(() => {
    localStorage.setItem(messageNavigatorOpenStorageKey, String(panel === 'navigator'));
  }, [panel]);

  useEffect(() => {
    localStorage.setItem(messageNavigatorWidthStorageKey, String(navigatorWidth));
  }, [navigatorWidth]);

  useEffect(() => {
    const toggleNavigator = (event: KeyboardEvent): void => {
      if (isTypingTarget(event.target) || !matchesShortcut(event, appShortcuts.toggleNavigator)) {
        return;
      }

      event.preventDefault();
      setPanel((current) => {
        return current === 'navigator' ? 'none' : 'navigator';
      });
    };

    window.addEventListener('keydown', toggleNavigator);

    return () => {
      window.removeEventListener('keydown', toggleNavigator);
    };
  }, []);

  if (filePath == null) {
    return (
      <div className="flex flex-1 items-center justify-center" data-viewer-empty>
        <EmptyState
          icon={<FileText />}
          title={t('noSessionSelected')}
          hint={t('pickSession')}
        />
      </div>
    );
  }

  const baseLabel = sessionTitle ?? filePath.split('/').at(-1);
  const title = baseLabel != null && baseLabel.length > 0 ? baseLabel : t('session', { ns: 'common' });

  let body: ReactNode;

  if (waiting) {
    body = (
      <div className="flex justify-center py-16" data-viewer-loading>
        <Loader icon={<MessageSquare />} label={t('loadingSessions')} />
      </div>
    );
  }
  else if (feed.phase === 'error') {
    // v8 ignore next -- unreachable by construction
    const failedTitle = feed.error ?? t('failedToLoad', { ns: 'common' });

    body = <EmptyState icon={<CircleAlert />} title={failedTitle} tone="error" />;
  }
  else {
    const remaining = feed.total - feed.entries.length;

    body = (
      <>
        <MessageTimeline
          entries={feed.entries}
          agent={agent}
          profile={profile}
          filters={filters}
          scrollElement={scrollElement}
          highlightTimestamp={highlightTimestamp}
          navigation={navigation}
        />
        {feed.hasMore && (
          <div className="flex justify-center pt-4 pb-2" data-load-more ref={setEndMarker}>
            <Button variant="subtle" onClick={feed.loadMore}>
              {t('loadMore', { count: remaining })}
            </Button>
          </div>
        )}
      </>
    );
  }

  return (
    <section
      className="
        flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background
      "
      data-session-viewer
    >
      <header className="shrink-0 border-b border-border">
        <div className="flex items-center gap-3 px-4.5 pt-2.75">
          <h2
            className="
              min-w-0 flex-1 truncate text-sm font-semibold text-foreground
            "
            data-session-title
          >
            {title}
          </h2>
          <span
            className="
              inline-flex shrink-0 items-center gap-1.5 text-body font-medium
              text-ok
            "
            title={feed.syncing ? t('checkingUpdates') : t('liveUpdates')}
            data-live
          >
            <span className={cn('size-1.5 rounded-full bg-current', feed.syncing && `
              animate-pulse
            `)}
            />
            {t('live')}
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            {supportsSidechains && (
              <IconButton
                variant="toolbar"
                label={t('includeSubagentActivity')}
                icon={<Users className="size-3.5" />}
                pressed={includeSidechain}
                onClick={() => {
                  setIncludeSidechain((value) => {
                    return !value;
                  });
                }}
              />
            )}
            {/* One segmented pair, one panel at a time (or none). */}
            <div className="
              flex items-center gap-0.5 rounded-md border border-border bg-muted
              p-0.5
            "
            >
              <IconButton
                variant="segment"
                label={t('navigator')}
                icon={<ListTree className="size-3.5" />}
                pressed={panel === 'navigator'}
                onClick={() => {
                  setPanel((current) => {
                    return current === 'navigator' ? 'none' : 'navigator';
                  });
                }}
              />
              <IconButton
                variant="segment"
                label={t('fileEdits')}
                icon={<FileText className="size-3.5" />}
                pressed={panel === 'edits'}
                onClick={() => {
                  setPanel((current) => {
                    return current === 'edits' ? 'none' : 'edits';
                  });
                }}
              />
            </div>
            <MessageFilterMenu filters={filters} onChange={setFilters} />
          </div>
        </div>
        {/* The sub-header: one mono line of who and what, then how much of it is
            loaded (or, once filtered, how much is shown). */}
        <div
          className="
            flex min-w-0 items-center gap-1.5 px-4.5 pt-1 pb-2.75 font-mono
            text-figure text-faint
          "
          data-session-meta
        >
          <span
            data-agent={agent}
            className="agent-dot size-1.5 shrink-0 rounded-full"
            aria-hidden
          />
          <span className="shrink-0">{agentBadgeLabel(agent, profile)}</span>
          {model != null && (
            <>
              <span className="text-dim">/</span>
              <span className="truncate">{model}</span>
            </>
          )}
          {gitBranch != null && (
            <>
              <span className="text-dim">/</span>
              <GitBranch className="size-3 shrink-0" />
              <span className="min-w-0 truncate" data-session-branch>{gitBranch}</span>
            </>
          )}
          <span className="text-dim">/</span>
          <span className="shrink-0">
            {t('messageCount', { count: feed.messageCount })}
          </span>
          <span
            className={cn(
              'ms-auto shrink-0 ps-2 tabular-nums',
              filtersActive && 'text-primary',
            )}
            data-loaded-count
          >
            {countLabel}
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="relative flex min-h-0 min-w-0 flex-1">
          <div
            ref={setScrollElement}
            className="
              min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4.5
              pt-1.5
            "
          >
            <div className="mx-auto max-w-5xl">
              {body}
            </div>
          </div>
          <ScrollToEnd
            scrollElement={scrollElement}
            hasMore={feed.hasMore}
            loading={feed.seeking}
            onLoadRest={feed.seekEnd}
          />
        </div>
        <CompanionPane
          panel={panel}
          width={navigatorWidth}
          agent={agent}
          profile={profile}
          entries={feed.entries}
          filters={filters}
          editedFiles={editedFiles}
          editsStatus={editsStatus}
          editsError={editsError}
          projectPath={projectPath}
          nowMs={nowMs}
          onOpenEdit={onOpenEdit}
          onNavigate={(index) => {
            setNavigation({ index });
          }}
          onResize={(delta) => {
            setNavigatorWidth((width) => {
              return clamp(width - delta, MIN_COMPANION_WIDTH, MAX_COMPANION_WIDTH);
            });
          }}
          onClose={() => {
            setPanel('none');
          }}
        />
      </div>
    </section>
  );
};
