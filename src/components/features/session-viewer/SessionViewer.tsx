import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  CircleAlert,
  FileText,
  ListFilter,
  ListTree,
  MessageSquare,
} from 'lucide-react';

import { agentOption } from '@config/agents';
import {
  messageFilterBarStorageKey,
  messageFiltersStorageKey,
  messageNavigatorOpenStorageKey,
  messageNavigatorWidthStorageKey,
} from '@config/storageKeys';

import { cn } from '@utils/cnUtils';

import {
  Badge,
  Button,
  EmptyState,
  PaneDivider,
  Spinner,
  useSmoothScroll,
} from '@ui/index';
import { useMessages } from '@features/history-data';

import { MessageTimeline } from './MessageTimeline';
import {
  ExportMenu,
  MessageFilterToolbar,
  MessageNavigator,
} from './partials';
import {
  countVisibleEntries,
  decodeMessageFilters,
  encodeMessageFilters,
  hasActiveMessageFilters,
} from './utils/messageFilterUtils';

import type { AgentId } from '@config/agents';
import type { FC, ReactNode } from 'react';
import type { TimelineNavigation } from './MessageTimeline';

export interface SessionViewerProps {
  readonly filePath: string | null;
  readonly agent?: AgentId | undefined;
  readonly projectLabel: string;
  readonly sessionTitle: string | undefined;
  readonly highlightTimestamp: string | undefined;
  readonly sourceModifiedMs?: number | undefined;
}

const MIN_NAVIGATOR_WIDTH = 220;
const MAX_NAVIGATOR_WIDTH = 420;
const DEFAULT_NAVIGATOR_WIDTH = 280;

const initialNavigatorWidth = (): number => {
  const stored = Number(localStorage.getItem(messageNavigatorWidthStorageKey));

  return Number.isFinite(stored) && stored >= MIN_NAVIGATOR_WIDTH
    ? Math.min(stored, MAX_NAVIGATOR_WIDTH)
    : DEFAULT_NAVIGATOR_WIDTH;
};

export const SessionViewer: FC<SessionViewerProps> = ({
  filePath,
  agent = 'claude',
  projectLabel,
  sessionTitle,
  highlightTimestamp,
  sourceModifiedMs = 0,
}) => {
  const { t } = useTranslation('session');
  const [includeSidechain, setIncludeSidechain] = useState(false);
  const [filters, setFilters] = useState(() => {
    return decodeMessageFilters(localStorage.getItem(messageFiltersStorageKey));
  });
  const [filterBarOpen, setFilterBarOpen] = useState(() => {
    return localStorage.getItem(messageFilterBarStorageKey) !== 'false';
  });
  const [navigatorOpen, setNavigatorOpen] = useState(() => {
    return localStorage.getItem(messageNavigatorOpenStorageKey) !== 'false';
  });
  const [navigatorWidth, setNavigatorWidth] = useState(initialNavigatorWidth);
  const [navigation, setNavigation] = useState<TimelineNavigation | null>(null);
  const supportsSidechains = agentOption(agent).supportsSidechains === true;
  const feed = useMessages(
    filePath,
    agent,
    supportsSidechains && includeSidechain,
    sourceModifiedMs,
  );
  /**
   * A callback ref, not useRef: the timeline's virtualizer has to attach its
   * scroll listener to this element, and a ref object is still null when the
   * child mounts, so nothing would ever re-render to hand it over.
   */
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const visibleEntries = countVisibleEntries(feed.entries, filters);
  // The bar can be dismissed while filters are on, so the header button stays
  // lit to explain why the transcript is shorter than the message count.
  const filtersActive = hasActiveMessageFilters(filters);

  useSmoothScroll(scrollElement);

  useEffect(() => {
    localStorage.setItem(messageFiltersStorageKey, encodeMessageFilters(filters));
  }, [filters]);

  useEffect(() => {
    localStorage.setItem(messageFilterBarStorageKey, String(filterBarOpen));
  }, [filterBarOpen]);

  useEffect(() => {
    localStorage.setItem(messageNavigatorOpenStorageKey, String(navigatorOpen));
  }, [navigatorOpen]);

  useEffect(() => {
    localStorage.setItem(messageNavigatorWidthStorageKey, String(navigatorWidth));
  }, [navigatorWidth]);

  useEffect(() => {
    const toggleNavigator = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'm') {
        event.preventDefault();
        setNavigatorOpen((current) => {
          return !current;
        });
      }
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
          icon={<FileText className="size-10" />}
          title={t('noSessionSelected')}
          hint={t('pickSession')}
        />
      </div>
    );
  }

  const baseLabel = sessionTitle ?? filePath.split('/').at(-1);
  const title = baseLabel != null && baseLabel.length > 0 ? baseLabel : t('session', { ns: 'common' });

  let body: ReactNode;

  if (feed.phase === 'loading' && feed.entries.length === 0) {
    body = (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }
  else if (feed.phase === 'error') {
    // v8 ignore next -- unreachable by construction
    const failedTitle = feed.error ?? t('failedToLoad', { ns: 'common' });

    body = <EmptyState icon={<CircleAlert className="size-10" />} title={failedTitle} />;
  }
  else {
    const remaining = feed.total - feed.entries.length;

    body = (
      <>
        <MessageTimeline
          entries={feed.entries}
          filters={filters}
          scrollElement={scrollElement}
          highlightTimestamp={highlightTimestamp}
          navigation={navigation}
        />
        {feed.hasMore && (
          <div className="flex justify-center pt-4 pb-2">
            <Button variant="subtle" onClick={feed.loadMore} data-load-more>
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
      <header className="
        flex min-h-14 shrink-0 items-center gap-2 border-b border-border
        bg-card/70 px-4
      "
      >
        <div className="max-w-[55%] min-w-0 flex-1">
          <h2
            className="truncate text-sm font-semibold text-foreground"
            data-session-title
          >
            {title}
          </h2>
          <p className="truncate text-xs text-muted-foreground">
            {projectLabel}
          </p>
        </div>
        <div className="ms-auto flex shrink-0 items-center gap-1.5">
          <Badge tone="success" title={feed.syncing ? t('checkingUpdates') : t('liveUpdates')}>
            <span className={cn('size-1.5 rounded-full bg-current', feed.syncing && `
              animate-pulse
            `)}
            />
            {t('live')}
          </Badge>
          <Badge tone="accent" title={t('userAndAssistant')}>
            <MessageSquare className="size-3" />
            {t('messageCount', { count: feed.messageCount })}
          </Badge>

          {supportsSidechains && (
            <Button
              size="sm"
              variant={includeSidechain ? 'primary' : 'ghost'}
              pressed={includeSidechain}
              onClick={() => {
                setIncludeSidechain((value) => {
                  return !value;
                });
              }}
              title={t('includeSubagents')}
            >
              <ListFilter className="size-3.5" />
              {t('includeSubagentActivity')}
            </Button>
          )}
          <Button
            size="sm"
            variant={filterBarOpen || filtersActive ? 'primary' : 'ghost'}
            pressed={filterBarOpen}
            onClick={() => {
              setFilterBarOpen((current) => {
                return !current;
              });
            }}
            title={filterBarOpen ? t('hideFilterBar') : t('showFilterBar')}
          >
            <ListFilter className="size-3.5" />
            {t('filters')}
          </Button>
          <Button
            size="sm"
            variant={navigatorOpen ? 'primary' : 'ghost'}
            pressed={navigatorOpen}
            onClick={() => {
              setNavigatorOpen((current) => {
                return !current;
              });
            }}
            title={t('openMessageNavigator')}
          >
            <ListTree className="size-3.5" />
            {t('navigator')}
          </Button>
          <ExportMenu entries={feed.entries} project={projectLabel} title={title} />
        </div>
      </header>

      {filterBarOpen && (
        <MessageFilterToolbar
          filters={filters}
          total={feed.entries.length}
          visible={visibleEntries}
          onChange={setFilters}
          onDismiss={() => {
            setFilterBarOpen(false);
          }}
        />
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div
          ref={setScrollElement}
          className="
            min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-4
          "
        >
          <div className="mx-auto max-w-5xl">
            {body}
          </div>
        </div>
        {navigatorOpen && (
          <>
            <PaneDivider
              label={t('resizeMessageNavigator')}
              value={navigatorWidth}
              min={MIN_NAVIGATOR_WIDTH}
              max={MAX_NAVIGATOR_WIDTH}
              orientation="horizontal"
              onResize={(delta) => {
                setNavigatorWidth((width) => {
                  return Math.min(
                    Math.max(width - delta, MIN_NAVIGATOR_WIDTH),
                    MAX_NAVIGATOR_WIDTH,
                  );
                });
              }}
            />
            <MessageNavigator
              entries={feed.entries}
              filters={filters}
              width={navigatorWidth}
              onNavigate={(index) => {
                setNavigation({ index });
              }}
              onClose={() => {
                setNavigatorOpen(false);
              }}
            />
          </>
        )}
      </div>
    </section>
  );
};
