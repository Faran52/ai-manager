import { Info } from 'lucide-react';

import type { SystemTurnEntry } from '@services/history/historyService';
import type { FC } from 'react';

export interface SystemNoticeProps {
  readonly entry: SystemTurnEntry;
}

export const SystemNotice: FC<SystemNoticeProps> = ({ entry }) => {
  return (
    <div
      className="
        mx-auto flex max-w-[80%] items-center gap-2 rounded-full bg-muted px-3
        py-1 text-xs text-muted-foreground
      "
      data-system-notice
      data-timestamp={entry.timestamp}
    >
      <Info className="size-3.5 shrink-0" />
      <span className="truncate">{entry.text}</span>
    </div>
  );
};
