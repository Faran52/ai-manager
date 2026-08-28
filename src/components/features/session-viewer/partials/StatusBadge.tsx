import { useTranslation } from 'react-i18next';

import {
  AlertTriangle,
  CheckCircle2,
  CircleSlash,
  Clock3,
} from 'lucide-react';

import { cn } from '@utils/cnUtils';

import type { ToolStatus } from '@services/history/historyService';
import type { FC, ReactNode } from 'react';

export interface StatusBadgeProps {
  readonly status: ToolStatus;
  readonly pending: boolean;
}

interface StatusLook {
  readonly icon: ReactNode;
  readonly labelKey: string;
  readonly className: string;
}

const LOOKS: Record<ToolStatus | 'pending', StatusLook> = {
  pending: {
    icon: <Clock3 className="size-3" />,
    labelKey: 'statusPending',
    className: 'bg-warn/15 text-warn',
  },
  ok: {
    icon: <CheckCircle2 className="size-3" />,
    labelKey: 'statusOk',
    className: 'bg-ok/15 text-ok',
  },
  error: {
    icon: <AlertTriangle className="size-3" />,
    labelKey: 'statusError',
    className: 'bg-destructive/15 text-destructive',
  },
  interrupted: {
    icon: <CircleSlash className="size-3" />,
    labelKey: 'statusInterrupted',
    className: 'bg-muted text-muted-foreground',
  },
};

export const StatusBadge: FC<StatusBadgeProps> = ({ status, pending }) => {
  const { t } = useTranslation('session');
  const look = LOOKS[pending ? 'pending' : status];

  return (
    <span
      className={cn(`
        inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5
        text-[10px] font-medium
      `, look.className)}
      data-status-badge={pending ? 'pending' : status}
    >
      {look.icon}
      {t(look.labelKey)}
    </span>
  );
};
