import { useTranslation } from 'react-i18next';

import {
  Check,
  ChevronRight,
  FileText,
  Plug,
  TriangleAlert,
} from 'lucide-react';

import { agentOption } from '@config/agents';

import { cn } from '@utils/cnUtils';
import {
  formatTimeAgo,
  shortPath,
  sizeLabel,
} from '@utils/formatUtils';

import { Badge } from '@ui/index';

import { agentIsConfigured } from '../utils/agentSetupUtils';

import { AgentDetailRow } from './AgentDetailRow';
import { PluginInventory } from './PluginInventory';

import type { AgentSetup, InstalledPlugin } from '@services/agents/agentsService';
import type { FC } from 'react';

export interface AgentCardProps {
  readonly setup: AgentSetup;
  readonly projectPath: string;
  readonly plugins: readonly InstalledPlugin[];
  readonly sessionCount: number;
  readonly nowMs: number;
  readonly flagged?: boolean | undefined;
  readonly onPluginToggle: (plugin: InstalledPlugin) => Promise<void>;
}

const GUTTER = 'flex w-4 shrink-0 justify-center';
const COUNT = 'w-24 shrink-0 font-mono text-xs whitespace-nowrap text-muted-foreground';

export const AgentCard: FC<AgentCardProps> = ({
  setup,
  projectPath,
  plugins,
  sessionCount,
  nowMs,
  flagged = false,
  onPluginToggle,
}) => {
  const { t, i18n } = useTranslation('setup');
  const isClaude = setup.agent === 'claude';
  const configured = agentIsConfigured(setup, plugins);
  const enabledPlugins = plugins.filter((plugin) => {
    return plugin.enabled;
  }).length;
  const sessions = sessionCount > 0 && (
    <span className="font-mono text-xs text-muted-foreground">
      {t('sessionsCount', { count: sessionCount })}
    </span>
  );

  if (!configured) {
    return (
      <div
        data-configured="false"
        className="flex items-center gap-2 py-1 ps-1 pe-2"
      >
        <span className={GUTTER} aria-hidden="true">
          <span className="size-1.5 rounded-full bg-muted-foreground/40" />
        </span>
        <h4 className="text-sm text-muted-foreground">{agentOption(setup.agent).label}</h4>
        <Badge>{t('notSetUp')}</Badge>
        <span className="ms-auto">{sessions}</span>
      </div>
    );
  }

  return (
    <details
      data-configured="true"
      open={flagged}
      className={cn('group rounded-md border bg-card', flagged
        ? 'border-warn/50'
        : 'border-border')}
    >
      <summary className="
        flex cursor-default list-none items-center gap-2 rounded-md py-1.5 ps-1
        pe-2
        hover:bg-muted-foreground/5
        focus-visible:outline-2 focus-visible:outline-offset-2
        focus-visible:outline-primary
      "
      >
        <span className={GUTTER} aria-hidden="true">
          {flagged
            ? <TriangleAlert className="size-3.5 text-warn" />
            : <Check className="size-3.5 text-ok" />}
        </span>
        {!flagged && <span className="sr-only">{t('ready', { ns: 'common' })}</span>}
        <h4 className="w-32 shrink-0 truncate text-sm font-semibold">
          {agentOption(setup.agent).label}
        </h4>
        <span className={COUNT}>{t('mcpCount', { count: setup.mcpServers.length })}</span>
        <span className={COUNT}>{t('rulesCount', { count: setup.rules.length })}</span>
        {isClaude && (
          <span className={COUNT}>
            {t('pluginsCount', {
              enabled: enabledPlugins,
              total: plugins.length,
            })}
          </span>
        )}
        <span className="ms-auto flex items-center gap-2">
          {flagged && <Badge tone="warn">{t('checkSetup')}</Badge>}
          {sessions}
          <ChevronRight className="
            size-3.5 text-muted-foreground transition-transform
            group-open:rotate-90
          "
          />
        </span>
      </summary>
      <div className="border-t border-border p-2">
        <dl className="grid gap-1.5 text-xs">
          <AgentDetailRow icon={<Plug className="size-3" />} label={t('mcp')}>
            {setup.mcpServers.length === 0
              ? <span className="text-muted-foreground">{t('none', { ns: 'common' })}</span>
              : setup.mcpServers.map((server) => {
                  return (
                    <Badge key={`${server.scope}-${server.name}`} title={server.source}>
                      {server.name}
                      <span className="ms-1 opacity-70">{server.scope}</span>
                    </Badge>
                  );
                })}
          </AgentDetailRow>
          <AgentDetailRow icon={<FileText className="size-3" />} label={t('rules')}>
            {setup.rules.length === 0
              ? <span className="text-muted-foreground">{t('none', { ns: 'common' })}</span>
              : setup.rules.map((rule) => {
                  return (
                    <Badge
                      key={rule.path}
                      tone={rule.bytes === 0 ? 'warn' : 'neutral'}
                      title={rule.bytes === 0 ? `${rule.path} · ${rule.scope} · empty` : `${rule.path} · ${rule.scope}`}
                    >
                      {shortPath(rule.path, projectPath)}
                      <span className="ms-1 opacity-70">
                        {`${sizeLabel(rule.bytes)} · ${formatTimeAgo(rule.modifiedMs, nowMs, i18n.language)}`}
                      </span>
                    </Badge>
                  );
                })}
          </AgentDetailRow>
        </dl>
        {isClaude && (
          <PluginInventory
            plugins={plugins}
            projectPath={projectPath}
            onToggle={onPluginToggle}
          />
        )}
      </div>
    </details>
  );
};
