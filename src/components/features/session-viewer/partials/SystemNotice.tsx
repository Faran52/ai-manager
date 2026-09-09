import { Info } from 'lucide-react';

import type { SystemTurnEntry } from '@services/history/historyService';
import type { FC } from 'react';

export interface SystemNoticeProps {
  readonly entry: SystemTurnEntry;
}

export const SystemNotice: FC<SystemNoticeProps> = ({ entry }) => {
  return (
    <div
      className="flex items-center gap-2 ps-9 text-figure text-dim"
      data-system-notice
      data-timestamp={entry.timestamp}
    >
      <Info className="size-3 shrink-0" />
      <span className="truncate">{entry.text}</span>
    </div>
  );
};
