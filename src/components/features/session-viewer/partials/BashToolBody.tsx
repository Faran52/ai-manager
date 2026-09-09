import { CodeLine } from '@ui/index';

import type { FC } from 'react';

export interface BashToolBodyProps {
  readonly command: string;
  readonly description?: string | undefined;
}

export const BashToolBody: FC<BashToolBodyProps> = ({ command, description }) => {
  // Codex records some shell calls with the command on the outcome alone, so an
  // empty one is left to its output rather than drawn as a blank code line.
  if (command.length === 0 && description == null) {
    return null;
  }

  return (
    <div className="space-y-2">
      {description != null && (
        <p className="text-body text-muted-foreground italic">
          {description}
        </p>
      )}
      {command.length > 0 && <CodeLine text={command} />}
    </div>
  );
};
