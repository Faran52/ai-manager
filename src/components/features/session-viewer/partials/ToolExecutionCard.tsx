import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AlertTriangle, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { cn } from '@utils/cnUtils';

import { collapseTransition } from '@ui/index';

import { OutcomeBody } from './OutcomeBody';
import { PatchView } from './PatchView';
import { ToolInputBody } from './ToolInputBody';

import type {
  ToolCall,
  ToolOutcome,
  ToolStatus,
} from '@services/history/historyService';
import type { FC } from 'react';

export interface ToolExecutionCardProps {
  readonly call: ToolCall;
  readonly outcome?: ToolOutcome | undefined;
}

const STATUS_LABELS: Record<ToolStatus, string> = {
  ok: 'statusOk',
  error: 'statusError',
  interrupted: 'statusInterrupted',
};

const STATUS_TONES: Record<ToolStatus, string> = {
  ok: 'bg-ok/10 text-ok',
  error: 'bg-destructive/10 text-destructive',
  interrupted: 'bg-warn/15 text-warn',
};

export const ToolExecutionCard: FC<ToolExecutionCardProps> = ({ call, outcome }) => {
  const { t } = useTranslation('session');
  const status: ToolStatus = outcome?.status ?? 'ok';
  const [open, setOpen] = useState(status === 'error');
  const isDiff = call.input.kind === 'file-edit' || call.input.kind === 'multi-edit';
  const showOutcome = outcome != null;

  return (
    <div
      className="overflow-hidden rounded-lg border border-border bg-card/60"
      data-tool-card
      data-tool-kind={call.input.kind}
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
        <span className="font-mono text-[11px] text-primary">
          {call.name}
        </span>
        <span className={cn(`
          ms-auto rounded-sm px-1.5 py-0.5 text-[10px] tracking-wide uppercase
        `, STATUS_TONES[status])}
        >
          {t(STATUS_LABELS[status])}
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
              <ToolInputBody call={call} />
              {showOutcome && isDiff && outcome.patch != null && <PatchView hunks={outcome.patch} />}
              {showOutcome && !isDiff && <OutcomeBody outcome={outcome} />}
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
