import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  ChevronDown,
  FileClock,
  Trash2,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { agentOption } from '@config/agents';

import { fetchArchive } from '@lib/apis/apiClient';
import { cn } from '@utils/cnUtils';
import { formatDateTime, sizeLabel } from '@utils/formatUtils';

import {
  Button,
  collapseTransition,
  Spinner,
} from '@ui/index';

import type { ArchivedSession, ArchiveSummary } from '@services/archive/archiveService';
import type { FC } from 'react';

export interface ArchiveCardProps {
  readonly archive: ArchiveSummary;
  readonly onOpenSession: (session: ArchivedSession) => void;
  readonly onDelete: (archive: ArchiveSummary) => void;
}

export const ArchiveCard: FC<ArchiveCardProps> = ({
  archive,
  onOpenSession,
  onDelete,
}) => {
  const { t } = useTranslation('archive');
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<readonly ArchivedSession[]>();
  const [loading, setLoading] = useState(false);

  const toggle = (): void => {
    const next = !open;

    setOpen(next);

    if (!next || sessions != null) {
      return;
    }

    setLoading(true);
    void (async (): Promise<void> => {
      try {
        const detail = await fetchArchive({ id: archive.id });

        setSessions(detail.archive?.sessions ?? []);
      }
      catch {
        setSessions([]);
      }
      finally {
        setLoading(false);
      }
    })();
  };

  return (
    <div
      className="overflow-hidden rounded-xl border border-border bg-card"
      data-archive-card
      data-archive-id={archive.id}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-start"
        >
          <span className="
            grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10
            text-primary
          "
          >
            <FileClock className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">
              {archive.note.length > 0 ? archive.note : formatDateTime(archive.createdMs)}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {t('archiveMeta', {
                count: archive.sessionCount,
                size: sizeLabel(archive.sizeBytes),
              })}
            </span>
          </span>
          <ChevronDown
            className={cn(`
              size-4 shrink-0 text-muted-foreground transition-transform
            `, open && 'rotate-180')}
          />
        </button>
        <Button
          size="sm"
          variant="ghost"
          title={t('deleteArchive')}
          onClick={() => {
            onDelete(archive);
          }}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={collapseTransition}
            className="overflow-hidden"
          >
            <div className="border-t border-border px-4 py-2">
              {loading && <Spinner />}
              {sessions?.length === 0 && (
                <p className="py-3 text-xs text-muted-foreground">{t('archiveEmpty')}</p>
              )}
              <ul className="grid gap-0.5">
                {(sessions ?? []).map((session) => {
                  return (
                    <li key={session.archivePath}>
                      <button
                        type="button"
                        onClick={() => {
                          onOpenSession(session);
                        }}
                        className="
                          flex w-full items-center gap-2 rounded-md px-2 py-1.5
                          text-start
                          hover:bg-accent
                        "
                      >
                        <span className="
                          shrink-0 font-mono text-[10px] text-muted-foreground
                        "
                        >
                          {agentOption(session.agent).label}
                        </span>
                        <span className="
                          min-w-0 flex-1 truncate text-xs text-foreground
                        "
                        >
                          {session.title}
                        </span>
                        <span className="
                          shrink-0 text-[10px] text-muted-foreground
                        "
                        >
                          {session.projectName}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
