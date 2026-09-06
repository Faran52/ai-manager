import { PanelLeft } from 'lucide-react';

import { Tooltip } from '@ui/index';

import type { FC } from 'react';

export interface PanelToggleProps {
  readonly label: string;
  readonly onToggle: () => void;
}

/**
 * Folds a sidebar column down to its marks, and unfolds it again.
 *
 * The control carries no text, so the name is a tooltip and an aria-label
 * rather than a title, which waits a second and never reaches a keyboard.
 */
export const PanelToggle: FC<PanelToggleProps> = ({ label, onToggle }) => {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        aria-label={label}
        onClick={onToggle}
        className="
          flex size-6 shrink-0 items-center justify-center rounded-md
          text-muted-foreground transition-colors
          hover:bg-accent hover:text-foreground
          focus-visible:ring-2 focus-visible:ring-ring
          focus-visible:outline-none
        "
      >
        <PanelLeft className="size-3.5" />
      </button>
    </Tooltip>
  );
};
