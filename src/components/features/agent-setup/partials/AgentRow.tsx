import { useTranslation } from 'react-i18next';

import {
  Blocks,
  Check,
  ChevronRight,
  TriangleAlert,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { agentOption } from '@config/agents';

import { cn } from '@utils/cnUtils';
import {
  formatTimeAgo,
  shortPath,
  sizeLabel,
} from '@utils/formatUtils';

import {
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
  readonly columns: number;
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly onOpenPlugins: () => void;
}

interface GroupProps {
  readonly label: string;
  readonly children: ReactNode;
  readonly tone?: 'default' | 'warn';
}

const CELL = 'py-2 pe-4 align-middle';
const NUMERIC = 'text-end tabular-nums';
const FIGURE = 'font-mono text-xs text-muted-foreground';
const NONE = '—';

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
        pt-0.5 text-[10px] font-medium tracking-wider uppercase
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
  columns,
  open,
  onToggle,
  onOpenPlugins,
}) => {
  const { t, i18n } = useTranslation('setup');
  const isClaude = setup.agent === 'claude';
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
    <>
      <tr
        data-agent={setup.agent}
        className={cn('border-b border-border/40', flagged && 'bg-warn/5')}
      >
        <th scope="row" className={cn(CELL, 'ps-1 text-start font-normal')}>
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
            <ChevronRight className={cn(`
              size-3.5 shrink-0 text-muted-foreground transition-transform
            `, open && 'rotate-90')}
            />
            {flagged
              ? <TriangleAlert className="size-3.5 shrink-0 text-warn" />
              : <Check className="size-3.5 shrink-0 text-ok" />}
            <span className="sr-only">
              {flagged ? t('checkSetup') : t('ready', { ns: 'common' })}
            </span>
            <span className="min-w-0 truncate text-sm font-semibold">
              {agentOption(setup.agent).label}
            </span>
          </button>
        </th>
        <td className={cn(CELL, NUMERIC, FIGURE)}>
          {setup.mcpServers.length === 0 ? NONE : setup.mcpServers.length}
        </td>
        <td className={cn(CELL, NUMERIC, FIGURE)}>
          {setup.rules.length === 0 ? NONE : setup.rules.length}
        </td>
        <td className={cn(CELL, NUMERIC, FIGURE)}>
          {isClaude ? `${String(enabledPlugins)}/${String(plugins.length)}` : NONE}
        </td>
        <td className={cn(CELL, NUMERIC, FIGURE, 'pe-1')}>
          {sessionCount === 0 ? NONE : sessionCount}
        </td>
      </tr>
      <AnimatePresence initial={false}>
        {open && (
          <tr data-agent-detail={setup.agent}>
            <td colSpan={columns} className="p-0">
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
                  ms-3 grid gap-4 border-s border-border ps-4 pt-3.5 pb-4
                  text-xs
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
                </dl>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  );
};
