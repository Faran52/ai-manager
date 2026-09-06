import { agentOption } from '@config/agents';

import { cn } from '@utils/cnUtils';

import { Tooltip } from '@ui/index';

import { PanelToggle } from './PanelToggle';

import type { AgentId } from '@config/agents';
import type { FC, ReactNode } from 'react';

export interface StripItem {
  readonly id: string;
  readonly label: string;
  // Set on a session, so its mark is the agent circle its open row already carries.
  readonly agent?: AgentId | undefined;
  readonly mark?: ReactNode;
  readonly selected: boolean;
  readonly onSelect: () => void;
}

export interface CollapsedStripProps {
  readonly expandLabel: string;
  readonly listLabel: string;
  readonly items: readonly StripItem[];
  readonly onExpand: () => void;
}

// "Claude Code" reads as CC and "OpenCode" as OC, so the capitals are the mark
// wherever there are two. A folder name has none, and keeps its first letters.
const initialsOf = (label: string): string => {
  const capitals = label.replace(/[^\p{Lu}]/gu, '');

  return (capitals.length > 1 ? capitals : label).slice(0, 2);
};

const markOf = (item: StripItem): ReactNode => {
  return item.mark ?? initialsOf(item.agent == null ? item.label : agentOption(item.agent).label);
};

/**
 * A column collapsed to its marks rather than hidden: a column that vanishes is
 * a lie about what is there. The selection bar stays on the mark, so you can
 * still see where you are and move without unfolding anything first.
 */
export const CollapsedStrip: FC<CollapsedStripProps> = ({
  expandLabel,
  listLabel,
  items,
  onExpand,
}) => {
  return (
    <div className="
      flex w-14 shrink-0 flex-col overflow-hidden border-e border-border
    "
    >
      <div className="
        flex h-9 shrink-0 items-center justify-center border-b border-border
      "
      >
        <PanelToggle label={expandLabel} onToggle={onExpand} />
      </div>
      <ul aria-label={listLabel} className="min-h-0 flex-1 overflow-y-auto py-2">
        {items.map((item) => {
          return (
            <li key={item.id}>
              <Tooltip content={item.label}>
                <button
                  type="button"
                  aria-label={item.label}
                  aria-current={item.selected}
                  onClick={item.onSelect}
                  className={cn(`
                    relative flex w-full justify-center py-1 transition-colors
                    hover:bg-accent/60
                    focus-visible:ring-2 focus-visible:ring-ring
                    focus-visible:outline-none
                  `, item.selected && 'bg-accent')}
                >
                  {item.selected && (
                    <span
                      aria-hidden="true"
                      className="
                        absolute inset-y-1 inset-s-0 w-0.5 rounded-e-full
                        bg-primary
                      "
                    />
                  )}
                  <span
                    data-agent={item.agent}
                    className={cn(`
                      flex size-8 items-center justify-center text-figure
                      font-semibold
                    `, item.agent == null
                      ? 'rounded-md bg-muted text-muted-foreground'
                      : 'sidebar-agent-mark rounded-full')}
                  >
                    {markOf(item)}
                  </span>
                </button>
              </Tooltip>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
