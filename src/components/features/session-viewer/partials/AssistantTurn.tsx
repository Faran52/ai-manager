import { useTranslation } from 'react-i18next';

import { EyeOff } from 'lucide-react';

import { MarkdownText } from '@ui/index';

import { MessageHeader } from './MessageHeader';
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
  readonly hiddenCount?: number;
}

export const AssistantTurn: FC<AssistantTurnProps> = ({
  entry,
  visibleBlocks = entry.blocks,
  outcomeFor,
  hiddenCount = 0,
}) => {
  const { t } = useTranslation('session');

  return (
    <article className="space-y-2" data-assistant-turn data-timestamp={entry.timestamp}>
      {entry.blocks.length > 0 && (
        <MessageHeader
          roleKey="assistant"
          timestamp={entry.timestamp}
          sidechain={entry.sidechain}
          model={entry.model}
          usage={entry.usage}
          costUsd={entry.costUsd}
        />
      )}
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
      {hiddenCount > 0 && (
        <p
          className="
            flex items-center gap-1.5 text-[11px] text-muted-foreground/80
          "
          data-hidden-blocks
        >
          <EyeOff className="size-3" />
          {t('hiddenBlocks', { count: hiddenCount })}
        </p>
      )}
    </article>
  );
};
