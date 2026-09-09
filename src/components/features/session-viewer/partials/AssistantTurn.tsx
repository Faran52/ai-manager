import { useTranslation } from 'react-i18next';

import { EyeOff } from 'lucide-react';

import { agentOption } from '@config/agents';

import { MarkdownView } from '@ui/index';

import { MessageHeader } from './MessageHeader';
import { ThinkingCard } from './ThinkingCard';
import { ToolExecutionCard } from './ToolExecutionCard';
import { TurnFrame } from './TurnFrame';

import type { AgentId } from '@config/agents';
import type {
  AssistantBlock,
  AssistantTurnEntry,
  ToolOutcome,
} from '@services/history/historyService';
import type { FC } from 'react';

export interface AssistantTurnProps {
  readonly entry: AssistantTurnEntry;
  // The session's agent, so the turn's mark carries its hue.
  readonly agent: AgentId;
  readonly visibleBlocks?: readonly AssistantBlock[];
  readonly outcomeFor: (toolUseId: string) => ToolOutcome | undefined;
  readonly hiddenCount?: number;
  readonly showHeader?: boolean;
}

export const AssistantTurn: FC<AssistantTurnProps> = ({
  entry,
  agent,
  visibleBlocks = entry.blocks,
  outcomeFor,
  hiddenCount = 0,
  showHeader = true,
}) => {
  const { t } = useTranslation('session');

  return (
    <article data-assistant-turn data-timestamp={entry.timestamp}>
      <TurnFrame speaker="assistant" agent={agent} continued={!showHeader}>
        <div className="space-y-2">
          {entry.blocks.length > 0 && showHeader && (
            <MessageHeader
              roleKey="assistant"
              name={agentOption(agent).label}
              timestamp={entry.timestamp}
              sidechain={entry.sidechain}
              model={entry.model}
              usage={entry.usage}
              costUsd={entry.costUsd}
            />
          )}
          {visibleBlocks.map((block, index) => {
            if (block.blockType === 'text') {
              return <MarkdownView key={`${entry.uuid}-${String(index)}`} text={block.text} trusted />;
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
                flex items-center gap-1.5 text-body text-muted-foreground/80
              "
              data-hidden-blocks
            >
              <EyeOff className="size-3" />
              {t('hiddenBlocks', { count: hiddenCount })}
            </p>
          )}
        </div>
      </TurnFrame>
    </article>
  );
};
