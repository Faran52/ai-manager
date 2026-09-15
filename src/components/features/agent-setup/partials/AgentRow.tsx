import { useTranslation } from 'react-i18next';

import {
  Blocks,
  ChevronRight,
  SlidersHorizontal,
  TriangleAlert,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { agentBadgeLabel, settingsAgents } from '@config/agents';

import { cn } from '@utils/cnUtils';
import {
  formatTimeAgo,
  shortPath,
  sizeLabel,
} from '@utils/formatUtils';

import {
  arriveInSequence,
  Badge,
  Button,
  collapseTransition,
} from '@ui/index';

import { modelSummaryOf } from '../utils/agentSetupUtils';

import type {
  AgentSetup,
  InstalledPlugin,
  SetupFinding,
} from '@services/agents/agentsService';
import type { FC, ReactNode } from 'react';

export interface AgentRowProps {
  readonly setup: AgentSetup;
  readonly projectPath: string;
  readonly plugins: readonly InstalledPlugin[];
  readonly findings: readonly SetupFinding[];
  readonly sessionCount: number;
  readonly nowMs: number;
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly onOpenPlugins: () => void;
  readonly onOpenSettings: () => void;
  // Position in the card grid, so the cards arrive one after another.
  readonly index: number;
}

interface GroupProps {
  readonly label: string;
  readonly children: ReactNode;
  readonly tone?: 'default' | 'warn';
}

/*
 * A figure only appears if the agent records it. Nine agents against four
 * numeric columns left five of them printing three dashes each, and a dash
 * cannot tell "records nothing" from "recorded zero".
 */
const CHIP = `
  inline-flex items-baseline gap-1 rounded-sm bg-muted px-1.5 py-0.5
  font-mono text-figure text-muted-foreground
`;

/*
 * Only a credential that exists is worth naming. Claude reports none whenever
 * settings.json carries no key, which is the ordinary subscription case, so
 * printing "no credentials" against it stated something alarming and untrue.
 */
const AUTH_LABELS: Readonly<Record<string, string>> = {
  'api-key': 'authApiKey',
  'oauth': 'authOauth',
  'env': 'authEnv',
};

// The qualifier rides inside its chip, dimmer than the name it qualifies.
const QUALIFIER = 'opacity-70';

/**
 * A line of the open row: its label, then whatever the agent records for it.
 *
 * The label column is fixed so MCP, RULES and MODEL line up down the left. A
 * crowded group then wraps inside its own line and pushes only the line below
 * it, rather than shoving the next group along.
 */
const Group: FC<GroupProps> = ({
  label,
  children,
  tone = 'default',
}) => {
  return (
    <div className="grid grid-cols-[4.25rem_minmax(0,1fr)] items-baseline gap-3">
      <dt className={cn(`
        pt-0.5 text-figure font-medium tracking-wider uppercase
      `, tone === 'warn' ? 'text-warn' : 'text-muted-foreground/80')}
      >
        {label}
      </dt>
      <dd className="flex min-w-0 flex-wrap items-baseline gap-1">
        {children}
      </dd>
    </div>
  );
};

export const AgentRow: FC<AgentRowProps> = ({
  setup,
  projectPath,
  plugins,
  findings,
  sessionCount,
  nowMs,
  open,
  onToggle,
  onOpenPlugins,
  onOpenSettings,
  index,
}) => {
  const { t, i18n } = useTranslation('setup');
  // Plugins are read from the default root only, so a profile card has no
  // plugin line: it would show another config dir's plugins as its own.
  const isClaude = setup.agent === 'claude' && setup.profile == null;
  const {
    model,
    authMethod,
    provider,
  } = modelSummaryOf(setup.modelAuth);
  const enabledPlugins = plugins.filter((plugin) => {
    return plugin.enabled;
  }).length;
  const authKey = authMethod == null ? undefined : AUTH_LABELS[authMethod];
  const flagged = findings.length > 0;
  const hasModelDetail = model != null || provider != null || authKey != null;

  return (
    <motion.li
      data-agent={setup.agent}
      className={cn('flex flex-col rounded-lg border bg-card px-3 py-2.5', flagged
        ? 'border-warn/35 bg-warn/5'
        : 'border-border')}
      {...arriveInSequence(index)}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="
          flex w-full items-center gap-2 rounded-md text-start
          focus-visible:outline-2 focus-visible:outline-offset-2
          focus-visible:outline-primary
        "
      >
        <span
          aria-hidden="true"
          className="
            project-provider-dot size-2 shrink-0 rounded-full bg-current
          "
        />
        <span className="min-w-0 truncate text-ui font-semibold">
          {agentBadgeLabel(setup.agent, setup.profile)}
        </span>
        {/* The tint says it too, but colour alone is not a marker. Nothing is
            drawn for a healthy agent: success is silence. */}
        {flagged && (
          <>
            <TriangleAlert className="size-3.5 shrink-0 text-warn" />
            <span className="sr-only">{t('checkSetup')}</span>
          </>
        )}
        {/* Written out, because configured but unused is a different state
            from records nothing, and a dash cannot say which. */}
        <span className={cn('ms-auto shrink-0 font-mono text-figure', sessionCount === 0
          ? 'text-dim'
          : 'text-muted-foreground')}
        >
          {sessionCount === 0
            ? t('noSessions')
            : t('sessionCount', { count: sessionCount })}
        </span>
        <ChevronRight className={cn(`
          size-3.5 shrink-0 text-faint transition-transform
        `, open && 'rotate-90')}
        />
      </button>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {setup.mcpServers.length > 0 && (
          <span className={CHIP}>
            {t('mcp')}
            <b className="font-semibold text-foreground">{setup.mcpServers.length}</b>
          </span>
        )}
        {setup.rules.length > 0 && (
          <span className={CHIP}>
            {t('rules')}
            <b className="font-semibold text-foreground">{setup.rules.length}</b>
          </span>
        )}
        {isClaude && plugins.length > 0 && (
          <span className={CHIP}>
            {t('pluginsTitle')}
            <b className="font-semibold text-foreground">
              {`${String(enabledPlugins)}/${String(plugins.length)}`}
            </b>
          </span>
        )}
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <div data-agent-detail={setup.agent}>
            <motion.div
              className="overflow-hidden"
              initial={{
                height: 0,
                opacity: 0,
              }}
              animate={{
                height: 'auto',
                opacity: 1,
              }}
              exit={{
                height: 0,
                opacity: 0,
              }}
              transition={collapseTransition}
            >
              {/*
                  * The counts are in the row already, so this holds what a count
                  * cannot say: why the row is flagged, which server at what
                  * scope, and how stale a rules file has gone. A group the agent
                  * records nothing for prints no line at all, so a bare setup
                  * stays one line rather than a column of empty placeholders.
                  */}
              <dl className="
                ms-3 grid gap-4 border-s border-border ps-4 pt-3.5 pb-4 text-xs
              "
              >
                {flagged && (
                  <Group label={t('colProblem')} tone="warn">
                    {findings.map((finding) => {
                      return (
                        <Badge
                          key={`${finding.kind}-${finding.detail}`}
                          tone="warn"
                          title={finding.detail}
                        >
                          {finding.summary}
                          <span className={QUALIFIER}>{finding.detail}</span>
                        </Badge>
                      );
                    })}
                  </Group>
                )}
                {setup.mcpServers.length > 0 && (
                  <Group label={t('mcp')}>
                    {setup.mcpServers.map((server) => {
                      return (
                        <Badge
                          key={`${server.scope}-${server.name}`}
                          title={server.command ?? server.source}
                        >
                          <span className="text-foreground">{server.name}</span>
                          <span className={QUALIFIER}>{server.scope}</span>
                        </Badge>
                      );
                    })}
                  </Group>
                )}
                {setup.rules.length > 0 && (
                  <Group label={t('rules')}>
                    {setup.rules.map((rule) => {
                      const age = formatTimeAgo(rule.modifiedMs, nowMs, i18n.language);

                      return (
                        <Badge
                          key={rule.path}
                          tone={rule.bytes === 0 ? 'warn' : 'neutral'}
                          title={rule.path}
                        >
                          <span className={rule.bytes === 0
                            ? undefined
                            : 'text-foreground'}
                          >
                            {shortPath(rule.path, projectPath)}
                          </span>
                          <span className={QUALIFIER}>
                            {rule.bytes === 0
                              ? `${rule.scope} · ${t('ruleEmpty')}`
                              : `${rule.scope} · ${sizeLabel(rule.bytes)} · ${age}`}
                          </span>
                        </Badge>
                      );
                    })}
                  </Group>
                )}
                {/* Named as configured rather than as the model in use: it is
                      the default from settings, and a project's sessions
                      routinely span several models. */}
                {hasModelDetail && (
                  <Group label={t('model')}>
                    {model != null && (
                      <Badge title={t('modelConfigured')}>
                        <span className="text-foreground">{model}</span>
                      </Badge>
                    )}
                    {provider != null && <Badge>{provider}</Badge>}
                    {authKey != null && <Badge>{t(authKey)}</Badge>}
                  </Group>
                )}
                {isClaude && (
                  <Group label={t('pluginsTitle')}>
                    <Button size="sm" onClick={onOpenPlugins}>
                      <Blocks className="size-3" />
                      {t('viewPlugins')}
                    </Button>
                  </Group>
                )}
                {settingsAgents.includes(setup.agent) && (
                  <Group label={t('configuration')}>
                    <Button size="sm" onClick={onOpenSettings}>
                      <SlidersHorizontal className="size-3" />
                      {t('viewConfiguration')}
                    </Button>
                  </Group>
                )}
              </dl>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.li>
  );
};
