import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CircleAlert, LayoutGrid } from 'lucide-react';

import {
  Button,
  EmptyState,
  Spinner,
} from '@ui/index';

import { boardAttributes, buildBoardModel } from './boardModel';
import {
  ActivityTimeline,
  EditedFileList,
  SessionGrid,
} from './partials';

import type { AsyncResource } from '@features/history-data';
import type { EditedFile, FileEdit } from '@services/edits/editsService';
import type { ProjectSummary, SessionSummary } from '@services/history/historyService';
import type { FC } from 'react';
import type { BoardAttribute } from './boardModel';

export type BoardPanel = 'sessions' | 'edits';

export interface BoardViewProps {
  readonly project: ProjectSummary | null;
  readonly sessions: readonly SessionSummary[];
  readonly sessionsStatus: AsyncResource<readonly SessionSummary[]>['status'];
  readonly edits: AsyncResource<readonly EditedFile[]>;
  readonly nowMs: number;
  readonly onOpenSession: (session: SessionSummary) => void;
  readonly onOpenEdit: (edit: FileEdit) => void;
}

// Keys, not text, the map lives outside the component where t is unavailable.
const ATTRIBUTE_LABELS: Record<BoardAttribute, string> = {
  messages: 'attributeMessages',
  size: 'attributeSize',
  duration: 'attributeDuration',
  recency: 'attributeRecency',
};

const PANELS: readonly BoardPanel[] = ['sessions', 'edits'];

const PANEL_LABELS: Record<BoardPanel, string> = {
  sessions: 'panelSessions',
  edits: 'panelEdits',
};

export const BoardView: FC<BoardViewProps> = ({
  project,
  sessions,
  sessionsStatus,
  edits,
  nowMs,
  onOpenSession,
  onOpenEdit,
}) => {
  const { t } = useTranslation('board');
  const [panel, setPanel] = useState<BoardPanel>('sessions');
  const [attribute, setAttribute] = useState<BoardAttribute>('messages');
  const model = useMemo(() => {
    return buildBoardModel(sessions, attribute, nowMs);
  }, [attribute, nowMs, sessions]);
  const files = edits.data ?? [];

  if (project == null) {
    return (
      <div className="flex flex-1 items-center justify-center" data-board-empty>
        <EmptyState
          icon={<LayoutGrid className="size-8" />}
          title={t('noProject')}
          hint={t('noProjectHint')}
        />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4" data-board-view>
      <div className="mx-auto grid max-w-4xl gap-4">
        <header className="grid gap-1">
          <h2 className="text-base font-semibold text-foreground">{t('heading', { project: project.name })}</h2>
          <p className="text-sm text-muted-foreground">{t('intro')}</p>
        </header>

        <nav className="flex w-fit items-center gap-1 rounded-lg bg-muted p-0.5" aria-label={t('panels')}>
          {PANELS.map((name) => {
            return (
              <Button
                key={name}
                size="sm"
                variant={name === panel ? 'primary' : 'ghost'}
                pressed={name === panel}
                onClick={() => {
                  setPanel(name);
                }}
              >
                {t(PANEL_LABELS[name])}
              </Button>
            );
          })}
        </nav>

        {panel === 'sessions' && (
          <div className="
            grid gap-4 rounded-xl border border-border bg-card p-4
          "
          >
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
                projectPath={project.actualPath}
                nowMs={nowMs}
                onOpenEdit={onOpenEdit}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
