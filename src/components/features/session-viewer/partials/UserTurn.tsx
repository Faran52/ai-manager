import { useTranslation } from 'react-i18next';

import { FileInput, Terminal } from 'lucide-react';

import { cn } from '@utils/cnUtils';

import {
  Disclosure,
  MarkdownView,
  OutputBlock,
} from '@ui/index';

import { defaultMessageFilters } from '../utils/messageFilterUtils';

import { InjectedContextBody } from './InjectedContextBody';
import { MessageHeader } from './MessageHeader';
import { OutcomeImages } from './OutcomeImages';
import { TurnFrame } from './TurnFrame';

import type { AgentId } from '@config/agents';
import type { ToolOutcome, UserTurnEntry } from '@services/history/historyService';
import type { FC } from 'react';
import type { MessageContentFilters } from '../utils/messageFilterUtils';

export interface UserTurnProps {
  readonly entry: UserTurnEntry;
  // Carried through to the shared frame; the user mark does not use it.
  readonly agent: AgentId;
  readonly orphans: readonly ToolOutcome[];
  readonly filters?: MessageContentFilters;
  readonly showHeader?: boolean;
}

export const UserTurn: FC<UserTurnProps> = ({
  entry,
  agent,
  orphans,
  filters = defaultMessageFilters().content,
  showHeader = true,
}) => {
  const { t } = useTranslation('session');
  const injectedText = filters.text ? entry.injectedText : undefined;
  const images = filters.text ? (entry.images ?? []) : [];

  return (
    <article
      data-user-turn
      data-meta={entry.meta ? 'true' : 'false'}
      data-timestamp={entry.timestamp}
    >
      <TurnFrame speaker="user" agent={agent} continued={!showHeader}>
        <div className="space-y-2">
          {showHeader && (
            <MessageHeader
              roleKey="user"
              timestamp={entry.timestamp}
              sidechain={entry.sidechain}
            />
          )}
          {filters.commands && entry.command != null && (
            <span className="
              inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1
              font-mono text-body text-primary
            "
            >
              <Terminal className="size-3.5" />
              {entry.command}
            </span>
          )}
          {filters.text && entry.text.length > 0 && (
            <div className={cn(entry.meta
              ? 'text-muted-foreground'
              : 'text-foreground-2')}
            >
              <MarkdownView text={entry.text} />
            </div>
          )}
          {images.length > 0 && (
            <div data-user-images>
              <OutcomeImages images={images} />
            </div>
          )}
          {injectedText != null && (
            <Disclosure
              className="rounded-lg border border-border bg-muted/40"
              triggerClassName="
                gap-1.5 px-3 py-1.5 text-body font-medium text-muted-foreground
              "
              summary={(
                <>
                  <FileInput className="size-3.5 shrink-0" />
                  <span>{t('injectedContext')}</span>
                </>
              )}
            >
              <div className="border-t border-border px-3 py-2">
                <InjectedContextBody text={injectedText} />
              </div>
            </Disclosure>
          )}
          {filters.tools && orphans.length > 0 && (
            <div className="space-y-2">
              {orphans.map((outcome) => {
                if (outcome.text == null) {
                  return null;
                }

                return (
                  <OutputBlock key={outcome.toolUseId} label={t('result')} text={outcome.text} />
                );
              })}
            </div>
          )}
        </div>
      </TurnFrame>
    </article>
  );
};
