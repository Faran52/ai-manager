import { Badge } from '@ui/index';

import type { FC } from 'react';

export interface KeyChipsProps {
  readonly keys: readonly string[];
  // A line above the chips naming what they are, where the surrounding card does not.
  readonly label?: string | undefined;
}

/**
 * The keys a surface reports, as chips rather than one comma-joined string: a
 * real Codex config names thirteen areas and the Claude user file sixteen
 * keys, which ran as an eleven-line paragraph of mono text.
 */
export const KeyChips: FC<KeyChipsProps> = ({ keys, label }) => {
  const chips = (
    <div className="flex flex-wrap gap-1">
      {keys.map((key) => {
        return <Badge key={key}>{key}</Badge>;
      })}
    </div>
  );

  if (label == null) {
    return chips;
  }

  return (
    <div className="grid gap-1.5">
      <span className="text-body text-muted-foreground">{label}</span>
      {chips}
    </div>
  );
};
