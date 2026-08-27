import { useTranslation } from 'react-i18next';

import { cn } from '@utils/cnUtils';
import { formatCost } from '@utils/formatUtils';

import { Badge, MarkdownText } from '@ui/index';

import { ThinkingCard } from './ThinkingCard';
import { ToolExecutionCard } from './ToolExecutionCard';

import type {
  AssistantBlock,
  AssistantTurnEntry,
  ToolOutcome,
} from '@services/history/historyService';
import type { FC } from 'react';

export interface AssistantTurnProps {
  readonly entry: AssistantTurnEntry;
  readonly visibleBlocks?: readonly AssistantBlock[];
  readonly outcomeFor: (toolUseId: string) => ToolOutcome | undefined;
}

export const AssistantTurn: FC<AssistantTurnProps> = ({
  entry,
  visibleBlocks = entry.blocks,
  outcomeFor,
}) => {
  const { t } = useTranslation('session');
  const usage = entry.usage;

  return (
    <article className="space-y-2" data-assistant-turn data-timestamp={entry.timestamp}>
      <div className={cn('flex flex-wrap items-center gap-1.5', entry.blocks.length === 0 && `
        hidden
      `)}
      >
        {entry.model != null && <Badge>{entry.model}</Badge>}
        {usage != null && usage.outputTokens > 0 && <Badge>{t('outTokens', { count: usage.outputTokens })}</Badge>}
        {usage != null && usage.cacheReadTokens > 0 && (
          <Badge>{t('cachedTokens', { count: usage.cacheReadTokens })}</Badge>
        )}
        {entry.costUsd != null && entry.costUsd > 0 && <Badge>{formatCost(entry.costUsd)}</Badge>}
      </div>
      {visibleBlocks.map((block, index) => {
        if (block.blockType === 'text') {
          return <MarkdownText key={`${entry.uuid}-${String(index)}`} text={block.text} />;
        }

        if (block.blockType === 'thinking') {
          return <ThinkingCard key={`${entry.uuid}-${String(index)}`} thinking={block.thinking} />;
        }

        if (block.blockType === 'redacted') {
          return <ThinkingCard key={`${entry.uuid}-${String(index)}`} thinking="[redacted]" />;
        }

        return (
          <ToolExecutionCard
            key={`${entry.uuid}-${String(index)}`}
            call={block.call}
            outcome={outcomeFor(block.call.id)}
          />
        );
      })}
    </article>
  );
};
