import { useTranslation } from 'react-i18next';

import { Terminal } from 'lucide-react';

import { cn } from '@utils/cnUtils';

import { CodeLine, TruncatedText } from '@ui/index';

import { defaultMessageFilters } from '../utils/messageFilterUtils';

import { MessageHeader } from './MessageHeader';

import type { ToolOutcome, UserTurnEntry } from '@services/history/historyService';
import type { FC } from 'react';
import type { MessageContentFilters } from '../utils/messageFilterUtils';

export interface UserTurnProps {
  readonly entry: UserTurnEntry;
  readonly orphans: readonly ToolOutcome[];
  readonly filters?: MessageContentFilters;
}

export const UserTurn: FC<UserTurnProps> = ({
  entry,
  orphans,
  filters = defaultMessageFilters().content,
}) => {
  const { t } = useTranslation('session');
  const injectedText = filters.text ? entry.injectedText : undefined;

  return (
    <article
      className="flex flex-col items-end gap-1.5"
      data-user-turn
      data-meta={entry.meta ? 'true' : 'false'}
      data-timestamp={entry.timestamp}
    >
      <MessageHeader
        roleKey="user"
        timestamp={entry.timestamp}
        sidechain={entry.sidechain}
        align="end"
      />
      {filters.commands && entry.command != null && (
        <span className="
          inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1
          font-mono text-xs text-primary
        "
        >
          <Terminal className="size-3.5" />
          {entry.command}
        </span>
      )}
      {filters.text && entry.text.length > 0 && (
        <p
          className={cn(
            `
              max-w-[85%] rounded-2xl rounded-br-sm px-3.5 py-2 text-sm/relaxed
              whitespace-pre-wrap
            `,
            entry.meta
              ? 'bg-muted text-muted-foreground'
              : 'bg-primary text-primary-foreground shadow-sm',
          )}
        >
          {entry.text}
        </p>
      )}
      {injectedText != null && (
        <details className="max-w-[85%] text-start" data-injected-context>
          <summary className="cursor-pointer text-xs text-muted-foreground">
            {t('injectedContext')}
          </summary>
          <div className="mt-1">
            <CodeLine text={injectedText} />
          </div>
        </details>
      )}
      {filters.tools && (
        <div className="w-full space-y-2">
          {orphans.map((outcome) => {
            if (outcome.text == null) {
              return null;
            }

            return <TruncatedText key={outcome.toolUseId} label={t('result')} text={outcome.text} />;
          })}
        </div>
      )}
    </article>
  );
};
