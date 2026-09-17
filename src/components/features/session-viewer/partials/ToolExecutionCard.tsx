import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  AlertTriangle,
  FileCode2,
  Globe2,
  PlugZap,
  Search,
  SquareTerminal,
  Wrench,
} from 'lucide-react';

import { cn } from '@utils/cnUtils';

import { Disclosure, PatchView } from '@ui/index';

import { mcpToolIdentity } from '../utils/mcpToolUtils';
import { toolSummary } from '../utils/toolSummaryUtils';

import { OutcomeBody } from './OutcomeBody';
import { StatusBadge } from './StatusBadge';
import { ToolInputBody } from './ToolInputBody';

import type {
  ToolCall,
  ToolOutcome,
  ToolStatus,
} from '@services/history/historyService';
import type { FC, ReactNode } from 'react';
import type { ToolTone } from '../utils/toolSummaryUtils';

export interface ToolExecutionCardProps {
  readonly call: ToolCall;
  readonly outcome?: ToolOutcome | undefined;
}

const TONE_ICONS: Record<ToolTone, ReactNode> = {
  code: <FileCode2 className="size-3.5" />,
  search: <Search className="size-3.5" />,
  shell: <SquareTerminal className="size-3.5" />,
  web: <Globe2 className="size-3.5" />,
  plug: <PlugZap className="size-3.5" />,
  plain: <Wrench className="size-3.5" />,
};

export const ToolExecutionCard: FC<ToolExecutionCardProps> = ({ call, outcome }) => {
  const { t } = useTranslation('session');
  const status: ToolStatus = outcome?.status ?? 'ok';
  const [open, setOpen] = useState(status === 'error');
  const showOutcome = outcome != null;
  // A checklist is the whole content of its own call, so there is no result to be waiting on.
  const isChecklist = call.input.kind === 'todo-write';
  const mcpIdentity = mcpToolIdentity(call);
  const summary = toolSummary(call, outcome);
  const failed = status === 'error';
  let outcomeKind: 'default' | 'mcp' | 'web-fetch' | 'web-search' = 'default';

  if (mcpIdentity != null) {
    outcomeKind = 'mcp';
  }
  else if (call.input.kind === 'web-search' || call.input.kind === 'web-fetch') {
    outcomeKind = call.input.kind;
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border',
        // A failed call keeps the card shape but takes the destructive colour, so
        // one failure in a run of twenty is never the amber a pending call wears.
        failed
          ? 'border-destructive/40 bg-destructive/[0.07]'
          : 'border-border bg-muted',
        open && 'rounded-b-none',
      )}
      data-tool-card
      data-tool-kind={outcomeKind}
      data-status={status}
    >
      <Disclosure
        open={open}
        onOpenChange={setOpen}
        triggerClassName="
          gap-2 px-2.5 py-1.5 text-body font-medium text-foreground
          hover:bg-accent/40
        "
        summary={(
          <>
            <span className="shrink-0 text-faint" data-tool-tone={summary.tone}>
              {TONE_ICONS[summary.tone]}
            </span>
            <span className="shrink-0 font-mono text-body text-primary">
              {summary.label}
            </span>
            {/* Always the flex child that takes the slack, empty or not, so the
                badge stays pinned right whether or not the call has a detail. */}
            <span
              className="
                min-w-0 flex-1 truncate font-mono text-body font-normal
                text-muted-foreground
              "
              title={summary.detail}
              data-tool-detail
            >
              {summary.detail}
            </span>
            <span className="shrink-0">
              <StatusBadge status={status} pending={outcome == null && !isChecklist} />
            </span>
          </>
        )}
      >
        <div className={cn(
          'space-y-2 border-t px-3 py-2',
          failed ? 'border-destructive/40' : 'border-border',
        )}
        >
          <ToolInputBody call={call} changeRecorded={outcome?.patch != null} />
          {/* A recorded diff wins over the outcome text either way: Codex reports
              apply_patch as a generic call, not a file-edit, but still hands its
              patch to the outcome. */}
          {showOutcome && outcome.patch != null && <PatchView hunks={outcome.patch} />}
          {showOutcome && outcome.patch == null && <OutcomeBody outcome={outcome} kind={outcomeKind} />}
          {failed && showOutcome && outcome.text == null && outcome.patch == null && (
            <p className="flex items-center gap-1 text-body text-destructive">
              <AlertTriangle className="size-3.5" />
              {' '}
              {t('toolErrorNoDetails')}
            </p>
          )}
        </div>
      </Disclosure>
    </div>
  );
};
