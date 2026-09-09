import { cn } from '@utils/cnUtils';
import { initialsOf } from '@utils/initialsUtils';

import { AgentMark, Tooltip } from '@ui/index';

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

/**
 * A session folds to the agent circle its open row carries; a project with no
 * agent folds to a square of the first letters of its folder name (there are no
 * capitals to read).
 */
const projectMark = (item: StripItem): ReactNode => {
  return item.mark ?? initialsOf(item.label);
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
    <div className="flex w-full shrink-0 flex-col overflow-hidden">
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
                  {item.agent == null
                    ? (
                        <span className="
                          flex size-8 items-center justify-center rounded-md
                          bg-muted text-figure font-semibold
                          text-muted-foreground
                        "
                        >
                          {projectMark(item)}
                        </span>
                      )
                    : (
                        <AgentMark
                          agent={item.agent}
                          className="size-8 text-figure"
                        />
                      )}
                </button>
              </Tooltip>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
