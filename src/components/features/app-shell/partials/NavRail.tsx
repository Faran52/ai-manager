import { useTranslation } from 'react-i18next';

import {
  Archive,
  BarChart3,
  HeartPulse,
  MessageSquare,
} from 'lucide-react';

import { cn } from '@utils/cnUtils';

import { Tooltip } from '@ui/index';

import type { AppView } from '@features/app-header';
import type { FC, ReactNode } from 'react';

export interface NavRailProps {
  readonly view: AppView;
  readonly onViewChange: (view: AppView) => void;
  // Findings waiting in Health, shown as a count on its icon.
  readonly flagged: number;
}

interface Destination {
  readonly id: AppView;
  readonly labelKey: string;
  readonly icon: ReactNode;
}

/*
 * Health sits last because it is where you go when something is wrong, not
 * where you work. Settings is not here at all: it opens as a sheet over
 * whatever you were doing.
 */
const DESTINATIONS: readonly Destination[] = [
  {
    id: 'sessions',
    labelKey: 'navSessions',
    icon: <MessageSquare className="size-4" />,
  },
  {
    id: 'analytics',
    labelKey: 'navAnalytics',
    icon: <BarChart3 className="size-4" />,
  },
  {
    id: 'archive',
    labelKey: 'navArchive',
    icon: <Archive className="size-4" />,
  },
  {
    id: 'health',
    labelKey: 'navHealth',
    icon: <HeartPulse className="size-4" />,
  },
];

export const NavRail: FC<NavRailProps> = ({
  view,
  onViewChange,
  flagged,
}) => {
  const { t } = useTranslation('common');

  return (
    <nav
      aria-label={t('navPrimary')}
      data-nav-rail
      className="
        flex w-14 shrink-0 flex-col items-center gap-1.5 border-e border-border
        bg-recess py-3
      "
    >
      {DESTINATIONS.map((destination) => {
        const active = view === destination.id;
        const label = t(destination.labelKey);

        return (
          <Tooltip content={label} key={destination.id} side="right">
            <button
              type="button"
              aria-current={active ? 'page' : undefined}
              aria-label={label}
              data-nav-destination={destination.id}
              onClick={() => {
                onViewChange(destination.id);
              }}
              className={cn(`
                relative flex size-10 items-center justify-center rounded-lg
                text-faint transition-colors
                hover:text-foreground
                focus-visible:ring-2 focus-visible:ring-ring
              `, active && 'bg-accent text-primary')}
            >
              {destination.icon}
              {destination.id === 'health' && flagged > 0 && (
                <span
                  data-nav-badge
                  className="
                    absolute inset-e-0.5 -top-0.5 flex min-w-4 items-center
                    justify-center rounded-full bg-warn px-1 font-mono
                    text-eyebrow font-semibold text-background
                  "
                >
                  {flagged}
                </span>
              )}
            </button>
          </Tooltip>
        );
      })}
    </nav>
  );
};
