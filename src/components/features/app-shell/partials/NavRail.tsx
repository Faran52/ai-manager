import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Archive,
  BarChart3,
  HeartPulse,
  Info,
  MessageSquare,
  RefreshCw,
  Settings,
} from 'lucide-react';
import { motion } from 'motion/react';

import { cn } from '@utils/cnUtils';

import {
  controlTransition,
  Menu,
  MenuItem,
  Tooltip,
  useReducedMotion,
  useToast,
} from '@ui/index';

import type { AppView } from '@features/app-header';
import type { FC, ReactNode } from 'react';

export interface NavRailProps {
  readonly view: AppView;
  readonly onViewChange: (view: AppView) => void;
  // Findings waiting in Health, shown as a count on its icon.
  readonly flagged: number;
  readonly onReload: () => void;
  readonly onOpenSettings: () => void;
  readonly onOpenAbout: () => void;
  // False where a native menu carries these, so the rail does not repeat them.
  readonly showSettings?: boolean | undefined;
  readonly versionMark?: ReactNode | undefined;
}

interface Destination {
  readonly id: AppView;
  readonly labelKey: string;
  readonly icon: ReactNode;
}

/*
 * Health sits last: it is where you go when something is wrong, not where you
 * work. Refresh and Settings sit apart, acting on the app rather than moving in it.
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

// Reduced motion gets the end state with no travel, same as Disclosure.
const INSTANT = { duration: 0 };

const RAIL_BUTTON = `
  relative flex size-10 items-center justify-center rounded-lg text-faint
  transition-colors
  hover:text-foreground
  focus-visible:ring-2 focus-visible:ring-ring
  disabled:pointer-events-none
`;

export const NavRail: FC<NavRailProps> = ({
  view,
  onViewChange,
  flagged,
  onReload,
  onOpenSettings,
  onOpenAbout,
  showSettings = true,
  versionMark,
}) => {
  const { t } = useTranslation('common');
  const { push } = useToast();
  const reduceMotion = useReducedMotion();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!refreshing) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setRefreshing(false);
    }, 3000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [refreshing]);

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
              className={cn(RAIL_BUTTON, active && 'text-primary')}
            >
              {/* One mark for the whole rail, so it glides to the new view
                  rather than vanishing here and appearing there. */}
              {active && (
                <motion.span
                  className="absolute inset-0 -z-10 rounded-lg bg-accent"
                  layoutId="rail-active"
                  transition={reduceMotion ? INSTANT : controlTransition}
                />
              )}
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

      <Tooltip content={refreshing ? t('refreshing') : t('refresh')} side="right">
        <button
          type="button"
          disabled={refreshing}
          onClick={() => {
            setRefreshing(true);
            onReload();
            push(t('refreshingToast'));
          }}
          aria-label={refreshing ? t('refreshing') : t('refresh')}
          className={cn(RAIL_BUTTON, 'mt-auto')}
        >
          <RefreshCw className={cn('size-4', refreshing && 'animate-spin')} />
        </button>
      </Tooltip>
      {versionMark != null && (
        <span className="flex h-6 items-center justify-center">{versionMark}</span>
      )}
      {showSettings && (
        <Menu
          align="end"
          label={t('navSettings')}
          trigger={(
            <button
              type="button"
              aria-label={t('navSettings')}
              className={RAIL_BUTTON}
              data-rail-settings
            >
              <Settings className="size-4" />
            </button>
          )}
        >
          <MenuItem icon={<Info className="size-3.5" />} onSelect={onOpenAbout}>
            {t('settingsAbout')}
          </MenuItem>
          <MenuItem icon={<Settings className="size-3.5" />} onSelect={onOpenSettings}>
            {t('navSettings')}
          </MenuItem>
        </Menu>
      )}
    </nav>
  );
};
