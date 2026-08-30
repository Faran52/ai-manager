import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  CircleAlert,
  GhostIcon,
  MessageSquareText,
} from 'lucide-react';

import { formatTimeAgo } from '@utils/formatUtils';

import {
  EmptyState,
  MetricCard,
  Spinner,
  TextInput,
} from '@ui/index';

import type { AsyncResource } from '@features/history-data';
import type { PromptHistory } from '@services/prompts/promptsService';
import type { FC } from 'react';

export interface PromptHistoryPanelProps {
  readonly history: AsyncResource<PromptHistory>;
  readonly nowMs: number;
  // Only ever called for a prompt whose transcript still exists.
  readonly onOpenPrompt: (filePath: string, timestampMs: number) => void;
}

const MAX_ROWS = 300;

export const PromptHistoryPanel: FC<PromptHistoryPanelProps> = ({
  history,
  nowMs,
  onOpenPrompt,
}) => {
  const { t, i18n } = useTranslation('session');
  const [query, setQuery] = useState('');
  const data = history.data;
  const needle = query.trim().toLowerCase();
  const matches = useMemo(() => {
    const prompts = data?.prompts ?? [];
    const filtered = needle.length === 0
      ? prompts
      : prompts.filter((prompt) => {
          return prompt.text.toLowerCase().includes(needle)
            || prompt.projectName.toLowerCase().includes(needle);
        });

    return filtered.slice(0, MAX_ROWS);
  }, [data, needle]);
  const orphanedProjects = (data?.projects ?? []).filter((project) => {
    return project.orphaned;
  });

  return (
    <div className="grid gap-3" data-prompt-history>
      <p className="text-sm text-muted-foreground">{t('promptsIntro')}</p>

      {history.status === 'loading' && <Spinner />}

      {history.status === 'error' && (
        <p className="
          flex items-center gap-2 rounded-lg border border-destructive/40
          bg-destructive/10 px-3 py-2 text-xs text-destructive
        "
        >
          <CircleAlert className="size-3.5" />
          {history.error}
        </p>
      )}

      {data != null && (
        <>
          <div className="
            grid gap-3
            sm:grid-cols-3
          "
          >
            <MetricCard
              label={t('promptsRecorded')}
              value={String(data.total)}
              icon={<MessageSquareText className="size-3.5" />}
            />
            <MetricCard label={t('promptProjects')} value={String(data.projects.length)} />
            <MetricCard
              label={t('promptsOrphaned')}
              value={String(orphanedProjects.length)}
              hint={t('promptsOrphanedHint')}
              icon={<GhostIcon className="size-3.5" />}
            />
          </div>

          <TextInput
            value={query}
            onInput={setQuery}
            label={t('searchPrompts')}
            placeholder={t('searchPrompts')}
          />

          {matches.length === 0
            ? (
                <EmptyState
                  icon={<MessageSquareText className="size-8" />}
                  title={t('noPrompts')}
                />
              )
            : (
                <ul className="grid gap-1">
                  {matches.map((prompt) => {
                    const filePath = prompt.filePath;
                    const meta = (
                      <span className="
                        mt-1 flex items-center gap-2 text-[10px]
                        text-muted-foreground
                      "
                      >
                        <span className="truncate">{prompt.projectName}</span>
                        <span>{formatTimeAgo(prompt.timestampMs, nowMs, i18n.language)}</span>
                        {filePath == null && (
                          <span className="
                            rounded-full bg-warn/15 px-1.5 py-0.5 text-warn
                          "
                          >
                            {t('promptSessionGone')}
                          </span>
                        )}
                      </span>
                    );

                    return (
                      <li key={`${prompt.sessionId}-${String(prompt.timestampMs)}`}>
                        {filePath == null
                          ? (
                              <div
                                className="
                                  rounded-lg border border-border bg-card px-3
                                  py-2 opacity-70
                                "
                                title={t('promptSessionGone')}
                              >
                                <span className="
                                  line-clamp-2 text-xs text-foreground
                                "
                                >
                                  {prompt.text}
                                </span>
                                {meta}
                              </div>
                            )
                          : (
                              <button
                                type="button"
                                title={t('openPromptSession')}
                                onClick={() => {
                                  onOpenPrompt(filePath, prompt.timestampMs);
                                }}
                                className="
                                  w-full rounded-lg border border-border bg-card
                                  px-3 py-2 text-start
                                  hover:border-primary/40 hover:bg-accent
                                "
                              >
                                <span className="
                                  line-clamp-2 text-xs text-foreground
                                "
                                >
                                  {prompt.text}
                                </span>
                                {meta}
                              </button>
                            )}
                      </li>
                    );
                  })}
                </ul>
              )}
        </>
      )}
    </div>
  );
};
