import { CodeLine } from '@ui/index';

import type { FC } from 'react';

export interface BashToolBodyProps {
  readonly command: string;
  readonly description?: string | undefined;
}

export const BashToolBody: FC<BashToolBodyProps> = ({ command, description }) => {
  return (
    <div className="space-y-2">
      {description != null && (
        <p className="text-xs text-muted-foreground italic">
          {description}
        </p>
      )}
      <CodeLine text={command} />
    </div>
  );
};
