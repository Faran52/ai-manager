import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { HeartPulse } from 'lucide-react';
import { motion } from 'motion/react';

import { agentBadgeLabel } from '@config/agents';

import {
  Badge,
  EmptyState,
  fadeTransition,
  Modal,
} from '@ui/index';
import { useSettings } from '@features/history-data';
import { SettingsView } from '@features/settings';

import {
  AgentRow,
  HealthHeader,
  PluginInventory,
  ProjectTrustCard,
} from './partials';
import { agentIsConfigured, setupKey } from './utils/agentSetupUtils';

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
  // Keyed by setupKey, so each Claude profile card counts its own sessions.
  readonly sessionCounts: Readonly<Record<string, number>>;
  readonly nowMs: number;
  readonly onPluginToggle: (plugin: InstalledPlugin) => Promise<void>;
}

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
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  const [pluginsOpen, setPluginsOpen] = useState(false);
  const [settingsFor, setSettingsFor] = useState<AgentSetup | null>(null);
  const settings = useSettings(
    settingsFor == null ? null : projectPath,
    settingsFor?.agent ?? 'claude',
    settingsFor?.profile,
  );

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
  const findingsFor = (setup: AgentSetup): readonly SetupFinding[] => {
    return findings.filter((finding) => {
      return finding.agent === setup.agent && finding.profile === setup.profile;
    });
  };
  const hasFinding = (setup: AgentSetup): boolean => {
    return findingsFor(setup).length > 0;
  };
  const configured = setups.filter((setup) => {
    return agentIsConfigured(setup, plugins);
  });
  const unconfigured = setups.filter((setup) => {
    return !agentIsConfigured(setup, plugins);
  });
  const flagged = configured.filter((setup) => {
    return hasFinding(setup);
  });
  /*
   * A flagged row leads and its warning marker says why, which is what the
   * separate "needs attention" heading used to do. One header row cannot
   * introduce three separately headed groups.
   */
  const listed = [...configured].sort((left, right) => {
    return Number(hasFinding(right)) - Number(hasFinding(left));
  });
  const first = flagged[0];
  const firstKey = first == null ? null : setupKey(first);
  const expanded = picked === undefined ? firstKey : picked;
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
      {/* A card per agent, because most of the table was dashes. Cards let a
          bare agent be two lines and a configured one be twelve, which is the
          information a fixed row shape threw away. */}
      {listed.length > 0 && (
        <ul
          className="
            grid gap-2.5
            lg:grid-cols-2
          "
          data-agent-list
        >
          {listed.map((setup, index) => {
            return (
              <AgentRow
                key={setupKey(setup)}
                index={index}
                setup={setup}
                projectPath={projectPath}
                plugins={plugins}
                sessionCount={sessionCounts[setupKey(setup)] ?? 0}
                findings={findingsFor(setup)}
                nowMs={nowMs}
                open={expanded === setupKey(setup)}
                onToggle={() => {
                  setPicked(expanded === setupKey(setup) ? null : setupKey(setup));
                }}
                onOpenPlugins={() => {
                  setPluginsOpen(true);
                }}
                onOpenSettings={() => {
                  setSettingsFor(setup);
                }}
              />
            );
          })}
        </ul>
      )}
      {unconfigured.length > 0 && (
        <section data-health-group="not-set-up">
          <h3 className="
            px-1 pb-1 text-body font-semibold tracking-wider
            text-muted-foreground uppercase
          "
          >
            {t('notSetUpHere')}
          </h3>
          <ul className="grid gap-1 px-1">
            {unconfigured.map((setup) => {
              return (
                <li
                  key={setupKey(setup)}
                  data-agent={setup.agent}
                  className="
                    flex items-center gap-2 text-sm text-muted-foreground
                  "
                >
                  {agentBadgeLabel(setup.agent, setup.profile)}
                  <Badge>{t('notSetUp')}</Badge>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <Modal
        open={pluginsOpen}
        onClose={() => {
          setPluginsOpen(false);
        }}
        title={t('pluginsTitle')}
        widthClass="max-w-3xl"
      >
        <div className="flex max-h-[70vh] flex-col">
          <h3
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
      <Modal
        open={settingsFor != null}
        onClose={() => {
          setSettingsFor(null);
        }}
        title={t('configuration')}
        widthClass="max-w-3xl"
        variant="sheet"
      >
        {/* The sheet variant gives the view a definite height to fill and
            scroll inside; a max-height wrapper alone left h-full nothing to
            resolve against and clipped the Save bar off the bottom. */}
        <SettingsView
          settings={settings}
          projectPath={projectPath}
          agent={settingsFor?.agent ?? 'claude'}
          profile={settingsFor?.profile}
        />
      </Modal>
    </motion.div>
  );
};
