import { visibleAssistantBlocks } from '../utils/messageFilterUtils';

import { AssistantTurn } from './AssistantTurn';
import { DateDivider } from './DateDivider';
import { SummaryDivider } from './SummaryDivider';
import { SystemNotice } from './SystemNotice';
import { UserTurn } from './UserTurn';

import type { AgentId } from '@config/agents';
import type { ToolOutcome } from '@services/history/historyService';
import type { FC } from 'react';
import type { MessageFilters } from '../utils/messageFilterUtils';
import type { TimelineRow } from '../utils/timelineUtils';

export interface TimelineRowBodyProps {
  readonly row: TimelineRow;
  readonly pairs: ReadonlyMap<string, ToolOutcome>;
  readonly orphans: ReadonlyMap<string, readonly ToolOutcome[]>;
  readonly filters: MessageFilters;
  readonly nowMs: number;
  readonly agent: AgentId;
  readonly profile: string | undefined;
}

export const TimelineRowBody: FC<TimelineRowBodyProps> = ({
  row,
  pairs,
  orphans,
  filters,
  nowMs,
  agent,
  profile,
}) => {
  if (row.kind === 'date') {
    return <DateDivider timestampMs={row.timestampMs} nowMs={nowMs} />;
  }

  const { entry } = row;

  switch (entry.kind) {
    case 'user':
      return (
        <UserTurn
          entry={entry}
          agent={agent}
          orphans={orphans.get(entry.uuid) ?? []}
          filters={filters.content}
          showHeader={!row.continues}
        />
      );
    case 'assistant': {
      const visible = visibleAssistantBlocks(entry.blocks, filters);

      return (
        <AssistantTurn
          entry={entry}
          agent={agent}
          profile={profile}
          visibleBlocks={visible.blocks}
          hiddenCount={visible.hiddenCount}
          outcomeFor={(toolUseId) => {
            return pairs.get(toolUseId);
          }}
          showHeader={!row.continues}
        />
      );
    }
    case 'system':
      return <SystemNotice entry={entry} />;
    case 'summary':
      return <SummaryDivider text={entry.text} />;
  }
};
