import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@utils/cnUtils';
import { toErrorMessage } from '@utils/errorUtils';

import { Spinner } from '@ui/index';

import { usePluginCosts } from '../hooks/usePluginCosts';

import type { InstalledPlugin, PluginCostAttribution } from '@services/agents/agentsService';
import type { FC } from 'react';

export interface PluginInventoryProps {
  readonly plugins: readonly InstalledPlugin[];
  readonly projectPath: string;
  readonly onToggle: (plugin: InstalledPlugin) => Promise<void>;
}

const CELL = 'truncate py-2 pe-4 text-start align-middle';

/*
 * The state cell holds a control, not text: truncate would clip the switch and
 * paint a stray ellipsis beside it.
 */
const SWITCH_CELL = 'py-2 pe-4 text-start align-middle whitespace-nowrap';

const SWITCH = `
  flex items-center gap-1.5 text-[10px] transition-opacity hover:opacity-80
  disabled:opacity-50
`;
const TRACK = 'relative inline-flex h-3 w-6 shrink-0 rounded-full transition-colors';
// Logical inset plus an RTL-mirrored shift, so the thumb travels inward either way.
const THUMB = 'absolute top-0.5 start-0.5 size-2 rounded-full transition-transform';
const HEAD = cn(CELL, `
  sticky top-0 z-10 bg-popover text-[10px] font-medium tracking-wider
  text-muted-foreground uppercase
`);
const NUMERIC = 'text-end';
const TABLE = 'w-full table-fixed border-collapse font-mono text-[11px]';
const ROW = `
  border-b border-border/40 last:border-0
  hover:bg-muted-foreground/5
`;

const TOKENS = new Intl.NumberFormat();

const tokensIn = (value: number): string => {
  return value === 0 ? '·' : TOKENS.format(value);
};

const PER_TURNS = 1000;

/*
 * Always-on context is re-sent on every turn, so a plugin costs a fraction of a
 * cent each time and four decimals rounded most of them to $0.0000. A thousand
 * turns is a scale worth acting on, and the per-turn figure stays in the title.
 */
const costIn = (perTurnUsd: number): string => {
  return perTurnUsd <= 0 ? '·' : `$${(perTurnUsd * PER_TURNS).toFixed(2)}`;
};

const SHA = /^[0-9a-f]{7,40}$/u;

/*
 * A commit id is not a version. Twelve hex characters crowd the column and say
 * no more than seven do, and a plugin with no version at all says nothing.
 */
const versionIn = (version: string): string => {
  if (version === 'unknown' || version.length === 0) {
    return '·';
  }

  return SHA.test(version) ? version.slice(0, 7) : version;
};

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

const costsById = (
  costs: readonly PluginCostAttribution[] | null,
): ReadonlyMap<string, PluginCostAttribution> => {
  return new Map((costs ?? []).map((cost) => {
    return [cost.plugin, cost];
  }));
};

export const PluginInventory: FC<PluginInventoryProps> = ({
  plugins,
  projectPath,
  onToggle,
}) => {
  const { t } = useTranslation('setup');
  const { costs, error } = usePluginCosts(projectPath);
  // Costs are read with the table, so a null list is still in flight.
  const loadingCosts = costs == null && error == null;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const byId = costsById(costs);

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

  if (plugins.length === 0) {
    return <p className="pt-3 text-xs text-muted-foreground">{t('none', { ns: 'common' })}</p>;
  }

  /*
   * The table waits for the figures rather than painting a column of dots that
   * reads as real data and then changes under the reader.
   */
  if (loadingCosts) {
    return (
      <section className="flex min-h-56 items-center justify-center">
        <Spinner />
      </section>
    );
  }

  return (
    <section>
      {/*
        * The cost figures are columns of this table rather than a second one.
        * A separate table repeated every plugin name to say three more numbers
        * about it, so the reader matched rows across two grids by eye.
        */}
      <p className="pb-2 text-[11px] text-muted-foreground">
        {costs?.length === 0 ? t('costsNone') : t('costsExplainer')}
      </p>
      <table className={TABLE}>
        <thead>
          <tr>
            <th scope="col" className={cn(HEAD, 'w-[26%] ps-2')}>{t('plugin')}</th>
            <th scope="col" className={cn(HEAD, 'w-[10%]')}>{t('scope')}</th>
            <th scope="col" className={cn(HEAD, 'w-[13%]')}>{t('version')}</th>
            <th scope="col" className={cn(HEAD, NUMERIC, 'w-[13%]')}>{t('costsAlwaysOn')}</th>
            <th scope="col" className={cn(HEAD, NUMERIC, 'w-[13%]')}>{t('costsPerInvoke')}</th>
            <th scope="col" className={cn(HEAD, NUMERIC, 'w-[15%]')}>{t('costsPerTurns')}</th>
            <th scope="col" className={cn(HEAD, 'w-[10%]')}>{t('state')}</th>
          </tr>
        </thead>
        <tbody>
          {ordered(plugins).map((plugin) => {
            const cost = byId.get(plugin.id);
            const name = plugin.id.split('@')[0];

            return (
              <tr
                key={plugin.id}
                className={cn(ROW, !plugin.enabled && 'text-muted-foreground')}
              >
                <td className={cn(CELL, 'ps-2')} title={plugin.marketplace}>
                  <span className={cn('block truncate', !plugin.enabled && `
                    line-through
                  `)}
                  >
                    {name}
                  </span>
                  {/* Nearly every plugin shares one marketplace, so only an
                      unrecognised one earns a line under the name. */}
                  {!plugin.knownMarketplace && (
                    <span className="block truncate text-[10px] text-warn">
                      {`${plugin.marketplace} ?`}
                    </span>
                  )}
                </td>
                <td className={cn(CELL, 'text-muted-foreground')}>
                  {plugin.scope === 'project' ? t('scopeProject') : t('scopeUser')}
                </td>
                <td
                  className={cn(CELL, 'text-muted-foreground/70 tabular-nums')}
                  title={plugin.version}
                >
                  {versionIn(plugin.version)}
                </td>
                <td className={cn(CELL, NUMERIC, `
                  text-muted-foreground tabular-nums
                `)}
                >
                  {cost == null ? '·' : tokensIn(cost.alwaysOnTokens)}
                </td>
                <td className={cn(CELL, NUMERIC, `
                  text-muted-foreground tabular-nums
                `)}
                >
                  {cost == null ? '·' : tokensIn(cost.onInvokeTokens)}
                </td>
                <td className={cn(CELL, NUMERIC, `
                  text-muted-foreground tabular-nums
                `)}
                >
                  {cost == null ? '·' : costIn(cost.estimatedCostUsd)}
                </td>
                <td className={SWITCH_CELL}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={plugin.enabled}
                    aria-label={name}
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
      {(actionError ?? error) != null && (
        <p className="mt-1 text-xs text-warn">{actionError ?? error}</p>
      )}
    </section>
  );
};
