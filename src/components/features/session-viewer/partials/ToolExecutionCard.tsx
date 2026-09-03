import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  AlertTriangle,
  ChevronDown,
  FileCode2,
  Globe2,
  PlugZap,
  Search,
  SquareTerminal,
  Wrench,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { cn } from '@utils/cnUtils';

import { collapseTransition, PatchView } from '@ui/index';

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
  const isDiff = call.input.kind === 'file-edit'
    || call.input.kind === 'multi-edit'
    || call.input.kind === 'file-write';
  const showOutcome = outcome != null;
  // A checklist is the whole content of its own call, so there is no result to be waiting on.
  const isChecklist = call.input.kind === 'todo-write';
  const mcpIdentity = mcpToolIdentity(call);
  const summary = toolSummary(call, outcome);
  let outcomeKind: 'default' | 'mcp' | 'web-fetch' | 'web-search' = 'default';

  if (mcpIdentity != null) {
    outcomeKind = 'mcp';
  }
  else if (call.input.kind === 'web-search' || call.input.kind === 'web-fetch') {
    outcomeKind = call.input.kind;
  }

  return (
    <div
      className="overflow-hidden rounded-lg border border-border bg-card/60"
      data-tool-card
      data-tool-kind={outcomeKind}
      data-status={status}
    >
      <button
        type="button"
        onClick={() => {
          setOpen((value) => {
            return !value;
          });
        }}
        aria-expanded={open}
        className="
          flex w-full items-center gap-2 px-3 py-1.5 text-start text-xs
          font-medium text-foreground
          hover:bg-muted/70
        "
      >
        <span className="shrink-0 text-primary" data-tool-tone={summary.tone}>
          {TONE_ICONS[summary.tone]}
        </span>
        <span className="shrink-0 font-mono text-[11px] text-primary">
          {summary.label}
        </span>
        {summary.detail.length > 0 && (
          <span
            className="
              min-w-0 flex-1 truncate font-mono text-[11px] font-normal
              text-muted-foreground
            "
            title={summary.detail}
            data-tool-detail
          >
            {summary.detail}
          </span>
        )}
        <span className={cn('shrink-0', summary.detail.length === 0 && 'ms-auto')}>
          <StatusBadge status={status} pending={outcome == null && !isChecklist} />
        </span>
        <ChevronDown className={cn(`
          size-3.5 shrink-0 text-muted-foreground transition-transform
        `, open && 'rotate-180')}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="tool-card-body"
            initial={{
              height: 0,
              opacity: 0,
            }}
            animate={{
              height: 'auto',
              opacity: 1,
            }}
            exit={{
              height: 0,
              opacity: 0,
            }}
            transition={collapseTransition}
            className="overflow-hidden"
          >
            <div className="space-y-2 border-t border-border px-3 py-2">
              <ToolInputBody call={call} changeRecorded={outcome?.patch != null} />
              {showOutcome && isDiff && outcome.patch != null && <PatchView hunks={outcome.patch} />}
              {showOutcome && !isDiff && <OutcomeBody outcome={outcome} kind={outcomeKind} />}
              {showOutcome && isDiff && outcome.patch == null && <OutcomeBody outcome={outcome} />}
              {status === 'error' && showOutcome && outcome.text == null && (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <AlertTriangle className="size-3.5" />
                  {' '}
                  {t('toolErrorNoDetails')}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
