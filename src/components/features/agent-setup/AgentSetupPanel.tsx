import { useTranslation } from 'react-i18next';

import { HeartPulse } from 'lucide-react';
import { motion } from 'motion/react';

import { EmptyState, fadeTransition } from '@ui/index';

import {
  AgentCard,
  ProjectTrustCard,
  ProjectUsageCard,
  SetupFindings,
} from './partials';
import { agentIsConfigured } from './utils/agentSetupUtils';

import type { AgentId } from '@config/agents';
import type {
  AgentSetup,
  InstalledPlugin,
  ProjectTrust,
  ProjectUsage,
  SetupFinding,
} from '@services/agents/agentsService';
import type { FC, ReactNode } from 'react';

export interface AgentSetupPanelProps {
  readonly projectSelected: boolean;
  readonly projectPath: string;
  readonly setups: readonly AgentSetup[];
  readonly findings: readonly SetupFinding[];
  readonly usage: ProjectUsage | null;
  readonly plugins: readonly InstalledPlugin[];
  readonly trust: ProjectTrust;
  readonly sessionCounts: Readonly<Partial<Record<AgentId, number>>>;
  readonly nowMs: number;
}

interface GroupProps {
  readonly name: string;
  readonly label: string;
  readonly children: ReactNode;
}

const Group: FC<GroupProps> = ({
  name,
  label,
  children,
}) => {
  return (
    <section data-health-group={name}>
      <h3 className="
        px-1 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground
        uppercase
      "
      >
        {label}
      </h3>
      <div className="grid gap-1">{children}</div>
    </section>
  );
};

export const AgentSetupPanel: FC<AgentSetupPanelProps> = ({
  projectSelected,
  projectPath,
  setups,
  findings,
  usage,
  plugins,
  trust,
  sessionCounts,
  nowMs,
}) => {
  const { t } = useTranslation('setup');
  if (!projectSelected) {
    return (
      <EmptyState
        icon={<HeartPulse className="size-5" />}
        title={t('noProjectSelected', { ns: 'sidebar' })}
        hint={t('chooseProject')}
      />
    );
  }

  if (projectPath.length === 0) {
    return (
      <EmptyState
        icon={<HeartPulse className="size-5" />}
        title={t('projectLocationUnknown', { ns: 'sidebar' })}
        hint={t('noFolderOnDisk')}
      />
    );
  }

  const hasFinding = (agent: AgentId): boolean => {
    return findings.some((finding) => {
      return finding.agent === agent;
    });
  };
  const configured = setups.filter((setup) => {
    return agentIsConfigured(setup, plugins);
  });
  const flagged = configured.filter((setup) => {
    return hasFinding(setup.agent);
  });
  const healthy = configured.filter((setup) => {
    return !hasFinding(setup.agent);
  });
  const unconfigured = setups.filter((setup) => {
    return !agentIsConfigured(setup, plugins);
  });

  const card = (setup: AgentSetup): ReactNode => {
    return (
      <AgentCard
        key={setup.agent}
        setup={setup}
        projectPath={projectPath}
        plugins={plugins}
        sessionCount={sessionCounts[setup.agent] ?? 0}
        nowMs={nowMs}
        flagged={hasFinding(setup.agent)}
      />
    );
  };

  const verdict = flagged.length === 0
    ? t('healthy')
    : t('needsAttentionCount', { count: flagged.length });

  return (
    <motion.div
      className="flex min-w-0 flex-col gap-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={fadeTransition}
    >
      <header className="px-1">
        <h2 className={flagged.length === 0
          ? 'text-lg font-semibold'
          : 'text-lg font-semibold text-warn'}
        >
          {verdict}
        </h2>
        <p className="mt-0.5 font-mono text-xs text-muted-foreground">
          {t('agentsSetUp', {
            configured: configured.length,
            total: setups.length,
          })}
        </p>
      </header>
      <SetupFindings findings={findings} />
      <ProjectTrustCard trust={trust} />
      {usage != null && <ProjectUsageCard usage={usage} nowMs={nowMs} />}
      {flagged.length > 0 && (
        <Group name="needs-attention" label={t('needsAttention')}>
          {flagged.map(card)}
        </Group>
      )}
      {healthy.length > 0 && (
        <Group name="set-up" label={t('setUp')}>
          {healthy.map(card)}
        </Group>
      )}
      {unconfigured.length > 0 && (
        <Group name="not-set-up" label={t('notSetUpHere')}>
          {unconfigured.map(card)}
        </Group>
      )}
    </motion.div>
  );
};
