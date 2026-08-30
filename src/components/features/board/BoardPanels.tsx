import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CircleAlert, LayoutGrid } from 'lucide-react';

import {
  Button,
  EmptyState,
  Spinner,
} from '@ui/index';

import {
  ActivityTimeline,
  EditedFileList,
  SessionGrid,
} from './partials';
import {
  ATTRIBUTE_LABELS,
  boardAttributes,
  buildBoardModel,
} from './utils/boardUtils';

import type { AsyncResource } from '@features/history-data';
import type { EditedFile, FileEdit } from '@services/edits/editsService';
import type { SessionSummary } from '@services/history/historyService';
import type { FC } from 'react';
import type { BoardAttribute } from './utils/boardUtils';

export interface BoardPanelsProps {
  readonly panel: 'sessions' | 'edits';
  // Absent means every project at once, which is what the whole-machine scope asks for.
  readonly project?: string | undefined;
  readonly sessions: readonly SessionSummary[];
  readonly sessionsStatus: 'loading' | 'ready' | 'error';
  readonly edits: AsyncResource<readonly EditedFile[]>;
  readonly nowMs: number;
  readonly onOpenSession: (session: SessionSummary) => void;
  readonly onOpenEdit: (edit: FileEdit) => void;
}

export const BoardPanels: FC<BoardPanelsProps> = ({
  panel,
  project,
  sessions,
  sessionsStatus,
  edits,
  nowMs,
  onOpenSession,
  onOpenEdit,
}) => {
  const { t } = useTranslation('board');
  const [attribute, setAttribute] = useState<BoardAttribute>('messages');
  const model = useMemo(() => {
    return buildBoardModel(sessions, attribute, nowMs);
  }, [attribute, nowMs, sessions]);
  const files = edits.data ?? [];

  return (
    <div className="grid gap-4 p-4" data-board-view>
      <p className="text-sm text-muted-foreground">{t('intro')}</p>

      {panel === 'sessions' && (
        <div className="grid gap-4 rounded-xl border border-border bg-card p-4">
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
      )}

      {panel === 'edits' && (
        <div className="grid gap-3">
          {edits.status === 'loading' && <Spinner />}

          {edits.status === 'error' && (
            <p className="
              flex items-center gap-2 rounded-lg border border-destructive/40
              bg-destructive/10 px-3 py-2 text-xs text-destructive
            "
            >
              <CircleAlert className="size-3.5" />
              {edits.error}
            </p>
          )}

          {edits.status === 'ready' && files.length === 0 && (
            <EmptyState
              icon={<LayoutGrid className="size-8" />}
              title={t('noEdits')}
              hint={t('noEditsHint')}
            />
          )}

          {files.length > 0 && (
            <EditedFileList
              files={files}
              projectPath={project}
              nowMs={nowMs}
              onOpenEdit={onOpenEdit}
            />
          )}
        </div>
      )}
    </div>
  );
};
