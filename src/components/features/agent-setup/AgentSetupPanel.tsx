import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { HeartPulse } from 'lucide-react';
import { motion } from 'motion/react';

import { agentOption } from '@config/agents';

import { cn } from '@utils/cnUtils';

import {
  Badge,
  EmptyState,
  fadeTransition,
  Modal,
} from '@ui/index';

import {
  AgentRow,
  HealthHeader,
  PluginInventory,
  ProjectTrustCard,
  ProjectUsageCard,
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
import type { FC } from 'react';

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

const PLUGINS_TITLE_ID = 'health-plugins-title';
const COLUMNS = 5;

const HEAD = `
  py-1.5 pe-4 text-[10px] font-medium tracking-wider text-muted-foreground
  uppercase
`;
const HEAD_NUMERIC = 'text-end';

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
   * agent opens itself. null is a row the reader shut, and it has to outrank
   * that default or the flagged row could never be closed. Findings arrive
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

  /*
   * Findings render inside the agent they name rather than in a list of their
   * own above the table, where the reader had to carry a summary back down to
   * the row wearing the warning marker.
   */
  const findingsFor = (agent: AgentId): readonly SetupFinding[] => {
    return findings.filter((finding) => {
      return finding.agent === agent;
    });
  };
  const hasFinding = (agent: AgentId): boolean => {
    return findingsFor(agent).length > 0;
  };
  const configured = setups.filter((setup) => {
    return agentIsConfigured(setup, plugins);
  });
  const unconfigured = setups.filter((setup) => {
    return !agentIsConfigured(setup, plugins);
  });
  const flagged = configured.filter((setup) => {
    return hasFinding(setup.agent);
  });
  /*
   * A flagged row leads and its warning marker says why, which is what the
   * separate "needs attention" heading used to do. One header row cannot
   * introduce three separately headed groups.
   */
  const listed = [...configured].sort((left, right) => {
    return Number(hasFinding(right.agent)) - Number(hasFinding(left.agent));
  });
  const expanded = picked === undefined ? flagged[0]?.agent ?? null : picked;
  const enabledPlugins = plugins.filter((plugin) => {
    return plugin.enabled;
  }).length;

  return (
    <motion.div
      className="flex min-w-0 flex-col gap-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={fadeTransition}
    >
      <HealthHeader
        configured={configured.length}
        total={setups.length}
        flagged={flagged.length}
        findingCount={findings.length}
        trust={trust}
        usage={usage}
      />
      <ProjectTrustCard trust={trust} />
      {listed.length > 0 && (
        <table className="w-full table-fixed border-collapse" data-agent-table>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className={cn(HEAD, 'w-[40%] ps-1 text-start')}>
                {t('colAgent')}
              </th>
              <th scope="col" className={cn(HEAD, HEAD_NUMERIC, 'w-[14%]')}>{t('mcp')}</th>
              <th scope="col" className={cn(HEAD, HEAD_NUMERIC, 'w-[14%]')}>{t('rules')}</th>
              <th scope="col" className={cn(HEAD, HEAD_NUMERIC, 'w-[16%]')}>
                {t('pluginsTitle')}
              </th>
              <th scope="col" className={cn(HEAD, HEAD_NUMERIC, 'w-[16%] pe-1')}>
                {t('sessions', { ns: 'sidebar' })}
              </th>
            </tr>
          </thead>
          <tbody>
            {listed.map((setup) => {
              return (
                <AgentRow
                  key={setup.agent}
                  setup={setup}
                  projectPath={projectPath}
                  plugins={plugins}
                  sessionCount={sessionCounts[setup.agent] ?? 0}
                  findings={findingsFor(setup.agent)}
                  nowMs={nowMs}
                  columns={COLUMNS}
                  open={expanded === setup.agent}
                  onToggle={() => {
                    setPicked(expanded === setup.agent ? null : setup.agent);
                  }}
                  onOpenPlugins={() => {
                    setPluginsOpen(true);
                  }}
                />
              );
            })}
          </tbody>
        </table>
      )}
      {unconfigured.length > 0 && (
        <section data-health-group="not-set-up">
          <h3 className="
            px-1 pb-1 text-[11px] font-semibold tracking-wider
            text-muted-foreground uppercase
          "
          >
            {t('notSetUpHere')}
          </h3>
          <ul className="grid gap-1 px-1">
            {unconfigured.map((setup) => {
              return (
                <li
                  key={setup.agent}
                  data-agent={setup.agent}
                  className="
                    flex items-center gap-2 text-sm text-muted-foreground
                  "
                >
                  {agentOption(setup.agent).label}
                  <Badge>{t('notSetUp')}</Badge>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {usage != null && <ProjectUsageCard usage={usage} nowMs={nowMs} />}
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
            {/* The dialog is already titled Plugins, so the count is only the ratio. */}
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
