import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { HeartPulse } from 'lucide-react';
import { motion } from 'motion/react';

import {
  EmptyState,
  fadeTransition,
  Modal,
} from '@ui/index';

import {
  AgentCard,
  HealthSummary,
  PluginInventory,
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
  readonly onPluginToggle: (plugin: InstalledPlugin) => Promise<void>;
}

interface GroupProps {
  readonly name: string;
  readonly label: string;
  readonly children: ReactNode;
}

const PLUGINS_TITLE_ID = 'health-plugins-title';

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
  onPluginToggle,
}) => {
  const { t } = useTranslation('setup');
  /*
   * undefined is nobody having chosen yet, which is when the first flagged
   * agent opens itself. null is a card the reader shut, and it has to outrank
   * that default or the flagged card could never be closed. Findings arrive
   * after mount, so seeding the state at first render would miss them.
   */
  const [picked, setPicked] = useState<AgentId | null | undefined>(undefined);
  const [pluginsOpen, setPluginsOpen] = useState(false);

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
  const expanded = picked === undefined ? flagged[0]?.agent ?? null : picked;
  const enabledPlugins = plugins.filter((plugin) => {
    return plugin.enabled;
  }).length;

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
        open={expanded === setup.agent}
        onToggle={() => {
          setPicked(expanded === setup.agent ? null : setup.agent);
        }}
        onOpenPlugins={() => {
          setPluginsOpen(true);
        }}
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
      <HealthSummary
        configured={configured.length}
        total={setups.length}
        findingCount={findings.length}
        trust={trust}
        usage={usage}
      />
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
      <Modal
        open={pluginsOpen}
        onClose={() => {
          setPluginsOpen(false);
        }}
        labelledBy={PLUGINS_TITLE_ID}
        widthClass="max-w-3xl"
      >
        <div className="flex max-h-[70vh] flex-col">
          <h3
            id={PLUGINS_TITLE_ID}
            className="
              flex items-baseline gap-2 border-b border-border px-3 py-2 text-sm
              font-semibold
            "
          >
            {t('pluginsTitle')}
            <span className="
              font-mono text-xs font-normal text-muted-foreground
            "
            >
              {`${String(enabledPlugins)}/${String(plugins.length)}`}
            </span>
          </h3>
          {/*
            * The body is the one scroller, so both tables share it and the
            * sticky heads have a scrolling ancestor to stick to. It carries no
            * top padding: a gap above the head is a strip of scrolled row that
            * stays visible over it.
            */}
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            <PluginInventory
              plugins={plugins}
              projectPath={projectPath}
              onToggle={onPluginToggle}
            />
          </div>
        </div>
      </Modal>
    </motion.div>
  );
};
