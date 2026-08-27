import {
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import {
  CircleAlert,
  FileText,
  ListFilter,
  MessageSquare,
} from 'lucide-react';

import { agentOption } from '@config/agents';

import {
  Badge,
  Button,
  EmptyState,
  Spinner,
} from '@ui/index';
import { useMessages } from '@features/history-data';

import { countVisibleEntries, defaultMessageFilters } from './messageFilters';
import { MessageTimeline } from './MessageTimeline';
import { ExportMenu, MessageFilterToolbar } from './partials';

import type { AgentId } from '@config/agents';
import type { FC, ReactNode } from 'react';

export interface SessionViewerProps {
  readonly filePath: string | null;
  readonly agent?: AgentId | undefined;
  readonly projectLabel: string;
  readonly sessionTitle: string | undefined;
  readonly highlightTimestamp: string | undefined;
}

export const SessionViewer: FC<SessionViewerProps> = ({
  filePath,
  agent = 'claude',
  projectLabel,
  sessionTitle,
  highlightTimestamp,
}) => {
  const { t } = useTranslation('session');
  const [includeSidechain, setIncludeSidechain] = useState(false);
  const [filters, setFilters] = useState(defaultMessageFilters);
  const supportsSidechains = agentOption(agent).supportsSidechains === true;
  const feed = useMessages(filePath, agent, supportsSidechains && includeSidechain);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrolledForRef = useRef<string | null>(null);
  const visibleEntries = countVisibleEntries(feed.entries, filters);

  useEffect(() => {
    if (highlightTimestamp == null || feed.entries.length === 0) {
      return;
    }

    if (scrolledForRef.current === highlightTimestamp) {
      return;
    }

    const target = scrollRef.current?.querySelector(`[data-timestamp="${highlightTimestamp}"]`);

    if (target != null) {
      target.scrollIntoView({ block: 'center' });
      scrolledForRef.current = highlightTimestamp;
    }
  }, [feed.entries, highlightTimestamp]);

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
        <MessageTimeline entries={feed.entries} filters={filters} />
        {feed.hasMore && (
          <div className="flex justify-center pt-4 pb-2">
            <Button variant="subtle" onClick={feed.loadMore} data-load-more>
              {`Load more (${String(remaining)} remaining)`}
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
          <Badge tone="accent" title={t('userAndAssistant')}>
            <MessageSquare className="size-3" />
            {`${String(feed.messageCount)} ${feed.messageCount === 1 ? 'message' : 'messages'}`}
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
              Include subagent activity
            </Button>
          )}
          <ExportMenu entries={feed.entries} project={projectLabel} title={title} />
        </div>
      </header>

      <MessageFilterToolbar
        filters={filters}
        total={feed.entries.length}
        visible={visibleEntries}
        onChange={setFilters}
      />

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4"
      >
        <div className="mx-auto max-w-5xl">
          {body}
        </div>
      </div>
    </section>
  );
};
