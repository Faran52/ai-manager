import { formatTokens } from '@utils/formatUtils';

import { AnalyticsPanel } from './AnalyticsPanel';

import type { SessionTokenTotals } from '@services/stats/statsService';
import type { FC } from 'react';

export interface TopSessionsProps {
  readonly onOpenSession: (session: SessionTokenTotals) => void;
  readonly sessions: readonly SessionTokenTotals[];
  readonly usageRecorded?: boolean;
}

export const TopSessions: FC<TopSessionsProps> = ({
  sessions,
  onOpenSession,
  usageRecorded = true,
}) => {
  return (
    <AnalyticsPanel title="Top sessions">
      <ul
        className="mt-2 divide-y divide-border"
        data-top-sessions
      >
        {sessions.map((session) => {
          const turnLabel = `${String(session.messages)} ${session.messages === 1 ? 'turn' : 'turns'}`;
          const usageLabel = usageRecorded ? formatTokens(session.tokens) : turnLabel;

          return (
            <li key={session.sessionId}>
              <button
                type="button"
                onClick={() => {
                  onOpenSession(session);
                }}
                className="
                  flex w-full items-center gap-3 py-1.5 text-left
                  hover:bg-accent
                "
              >
                <span className="
                  min-w-0 flex-1 truncate text-xs text-foreground
                "
                >
                  {session.title ?? session.sessionId}
                </span>
                <span className="font-mono text-xs text-primary">
                  {usageLabel}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </AnalyticsPanel>
  );
};
