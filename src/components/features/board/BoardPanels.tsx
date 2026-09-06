import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LayoutGrid } from 'lucide-react';

import {
  Button,
  EmptyState,
  Spinner,
} from '@ui/index';

import { ActivityTimeline, SessionGrid } from './partials';
import {
  ATTRIBUTE_LABELS,
  boardAttributes,
  buildBoardModel,
} from './utils/boardUtils';

import type { SessionSummary } from '@services/history/historyService';
import type { FC } from 'react';
import type { BoardAttribute } from './utils/boardUtils';

export interface BoardPanelsProps {
  readonly sessions: readonly SessionSummary[];
  readonly sessionsStatus: 'loading' | 'ready' | 'error';
  readonly nowMs: number;
  readonly onOpenSession: (session: SessionSummary) => void;
}

/**
 * The board alone. The file edits it used to carry now open beside the
 * transcript that made them, which is the only place the pairing means
 * anything.
 */
export const BoardPanels: FC<BoardPanelsProps> = ({
  sessions,
  sessionsStatus,
  nowMs,
  onOpenSession,
}) => {
  const { t } = useTranslation('board');
  const [attribute, setAttribute] = useState<BoardAttribute>('messages');
  const model = useMemo(() => {
    return buildBoardModel(sessions, attribute, nowMs);
  }, [attribute, nowMs, sessions]);
  return (
    <div className="grid gap-4 p-4" data-board-view>
      <div className="grid gap-4 rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">{t('intro')}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="me-1 text-xs text-muted-foreground">{t('colourBy')}</span>
          {boardAttributes.map((name) => {
            return (
              <Button
                key={name}
                size="sm"
                variant={name === attribute ? 'primary' : 'ghost'}
                pressed={name === attribute}
                onClick={() => {
                  setAttribute(name);
                }}
              >
                {t(ATTRIBUTE_LABELS[name])}
              </Button>
            );
          })}
        </div>

        {sessionsStatus === 'loading' && <Spinner />}

        {sessionsStatus === 'ready' && sessions.length === 0 && (
          <EmptyState icon={<LayoutGrid className="size-8" />} title={t('noSessions')} />
        )}

        {sessions.length > 0 && (
          <>
            <SessionGrid
              model={model}
              attribute={attribute}
              nowMs={nowMs}
              onOpenSession={onOpenSession}
            />
            <ActivityTimeline days={model.days} />
          </>
        )}
      </div>
    </div>
  );
};
