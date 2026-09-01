import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Blocks } from 'lucide-react';

import { cn } from '@utils/cnUtils';
import { toErrorMessage } from '@utils/errorUtils';

import { usePluginCosts } from '../hooks/usePluginCosts';

import type { InstalledPlugin } from '@services/agents/agentsService';
import type { FC } from 'react';

export interface PluginInventoryProps {
  readonly plugins: readonly InstalledPlugin[];
  readonly projectPath: string;
  readonly onToggle: (plugin: InstalledPlugin) => Promise<void>;
}

const CELL = 'truncate py-1 pe-4 text-start align-middle';

/*
 * The state cell holds a control, not text: truncate would clip the switch and
 * paint a stray ellipsis beside it.
 */
const SWITCH_CELL = 'py-1 pe-4 text-start align-middle whitespace-nowrap';

const SWITCH = `
  flex items-center gap-1.5 text-[10px] transition-opacity hover:opacity-80
  disabled:opacity-50
`;
const TRACK = 'relative inline-flex h-3 w-6 shrink-0 rounded-full transition-colors';
// Logical inset plus an RTL-mirrored shift, so the thumb travels inward either way.
const THUMB = 'absolute top-0.5 start-0.5 size-2 rounded-full transition-transform';
const HEAD = cn(CELL, `
  sticky top-0 bg-card text-[10px] font-medium tracking-wider
  text-muted-foreground uppercase
`);
const ACTION = `
  rounded-sm border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground
  transition-colors hover:text-foreground disabled:opacity-50
`;

const rank = (plugin: InstalledPlugin): number => {
  if (!plugin.enabled) {
    return 0;
  }

  return plugin.knownMarketplace ? 2 : 1;
};

// Disabled first, then unknown marketplaces, then the healthy rest alphabetically.
const ordered = (plugins: readonly InstalledPlugin[]): readonly InstalledPlugin[] => {
  return [...plugins].sort((left, right) => {
    return rank(left) - rank(right) || left.id.localeCompare(right.id);
  });
};

export const PluginInventory: FC<PluginInventoryProps> = ({
  plugins,
  projectPath,
  onToggle,
}) => {
  const { t } = useTranslation('setup');
  const {
    costs,
    estimating,
    error,
    estimate,
  } = usePluginCosts(projectPath);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const active = plugins.filter((plugin) => {
    return plugin.enabled;
  });

  const toggle = async (plugin: InstalledPlugin): Promise<void> => {
    setBusyId(plugin.id);
    setActionError(null);

    try {
      await onToggle(plugin);
    }
    catch (cause) {
      setActionError(toErrorMessage(cause));
    }
    finally {
      setBusyId(null);
    }
  };

  return (
    <section className="mt-2 border-t border-border pt-2">
      <h5 className="
        flex items-center gap-1.5 pb-1 text-xs text-muted-foreground
      "
      >
        <Blocks className="size-3" />
        {t('pluginsCount', {
          enabled: active.length,
          total: plugins.length,
        })}
      </h5>
      {plugins.length === 0
        ? <p className="text-xs text-muted-foreground">{t('none', { ns: 'common' })}</p>
        : (
            <div className="
              max-h-56 max-w-3xl overflow-y-auto rounded-sm border
              border-border/60
            "
            >
              <table className="
                w-full table-fixed border-collapse font-mono text-[11px]
              "
              >
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className={cn(HEAD, 'w-[26%] ps-2')}>{t('plugin')}</th>
                    <th scope="col" className={cn(HEAD, 'w-[26%]')}>{t('marketplace')}</th>
                    <th scope="col" className={cn(HEAD, 'w-[13%]')}>{t('scope')}</th>
                    <th scope="col" className={cn(HEAD, 'w-[15%]')}>{t('version')}</th>
                    <th scope="col" className={cn(HEAD, 'w-[20%]')}>{t('state')}</th>
                  </tr>
                </thead>
                <tbody>
                  {ordered(plugins).map((plugin) => {
                    const version = plugin.version === 'unknown' ? '' : plugin.version;

                    return (
                      <tr
                        key={plugin.id}
                        className={cn('hover:bg-muted-foreground/5', !plugin.enabled && `
                          text-muted-foreground
                        `)}
                      >
                        <td className={cn(CELL, 'ps-2', !plugin.enabled && `
                          line-through
                        `)}
                        >
                          {plugin.id.split('@')[0]}
                        </td>
                        <td className={cn(CELL, 'text-muted-foreground')}>
                          {plugin.knownMarketplace
                            ? plugin.marketplace
                            : <span className="text-warn">{`${plugin.marketplace} ?`}</span>}
                        </td>
                        <td className={cn(CELL, 'text-muted-foreground')}>
                          {plugin.scope === 'project' ? t('scopeProject') : t('scopeUser')}
                        </td>
                        <td className={cn(CELL, 'text-muted-foreground/70')}>
                          {version.length > 0 ? version : '·'}
                        </td>
                        <td className={SWITCH_CELL}>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={plugin.enabled}
                            aria-label={plugin.id.split('@')[0]}
                            disabled={busyId === plugin.id}
                            onClick={() => {
                              void toggle(plugin);
                            }}
                            className={SWITCH}
                          >
                            <span className={cn(TRACK, plugin.enabled
                              ? 'bg-ok/60'
                              : 'bg-muted-foreground/30')}
                            >
                              <span className={cn(THUMB, plugin.enabled
                                ? `
                                  translate-x-3 bg-ok
                                  rtl:-translate-x-3
                                `
                                : 'bg-muted-foreground')}
                              />
                            </span>
                            <span className={plugin.enabled
                              ? 'text-ok'
                              : 'text-muted-foreground'}
                            >
                              {plugin.enabled ? t('stateOn') : t('stateOff')}
                            </span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      {plugins.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            disabled={estimating}
            onClick={() => {
              void estimate();
            }}
            className={ACTION}
          >
            {estimating ? t('costsEstimating') : t('costsEstimate')}
          </button>
          {costs != null && (
            costs.length === 0
              ? <p className="mt-1 text-xs text-muted-foreground">{t('costsNone')}</p>
              : (
                  <ul className="
                    mt-1 space-y-0.5 font-mono text-[11px] text-muted-foreground
                  "
                  >
                    {costs.map((cost) => {
                      return (
                        <li key={cost.plugin}>
                          {`${cost.plugin}: ~${String(cost.alwaysOnTokens)} tok ${t('costsAlwaysOn')}, `
                            + `~${String(cost.onInvokeTokens)} tok ${t('costsPerInvoke')}, `
                            + `$${cost.estimatedCostUsd.toFixed(4)}`}
                        </li>
                      );
                    })}
                  </ul>
                )
          )}
        </div>
      )}
      {(actionError ?? error) != null && (
        <p className="mt-1 text-xs text-warn">{actionError ?? error}</p>
      )}
    </section>
  );
};
