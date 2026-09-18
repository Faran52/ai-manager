import { Badge } from '@ui/index';

import type { PreservedKey } from '@services/settings/settingsService';
import type { FC } from 'react';

export interface KeyChipsProps {
  readonly keys: readonly PreservedKey[];
  // A line above the chips naming what they are, where the surrounding card does not.
  readonly label?: string | undefined;
}

// The keys a surface reports, as chips rather than one comma-joined string: a real
// Codex config names thirteen areas, which ran as an eleven-line mono paragraph.
export const KeyChips: FC<KeyChipsProps> = ({ keys, label }) => {
  const chips = (
    <div className="flex flex-wrap gap-1">
      {keys.map((key) => {
        return (
          <Badge key={key.name}>
            {key.name}
            {key.value != null && key.value.length > 0 && (
              <span className="font-mono opacity-70">{key.value}</span>
            )}
          </Badge>
        );
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
