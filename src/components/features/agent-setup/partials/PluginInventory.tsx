import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@utils/cnUtils';

import {
  Spinner,
  Switch,
  useMutationRunner,
} from '@ui/index';

import {
  CELL,
  COLUMNS,
  DEFAULT_SORT,
  NUMERIC,
  ROW,
  SWITCH_CELL,
  TABLE,
} from '../constants';
import { usePluginCosts } from '../hooks/usePluginCosts';
import {
  costIn,
  costsById,
  ordered,
  toggleSort,
  tokensIn,
  versionIn,
} from '../utils/pluginTableUtils';

import { SortHead } from './SortHead';

import type { InstalledPlugin } from '@services/agents/agentsService';
import type { FC } from 'react';
import type { SortKey, SortState } from './SortHead';

export interface PluginInventoryProps {
  readonly plugins: readonly InstalledPlugin[];
  readonly projectPath: string;
  // The Claude profile these plugins belong to, for the cost read.
  readonly profile?: string | undefined;
  readonly onToggle: (plugin: InstalledPlugin) => Promise<void>;
}

export const PluginInventory: FC<PluginInventoryProps> = ({
  plugins,
  projectPath,
  profile,
  onToggle,
}) => {
  const { t } = useTranslation('setup');
  const { costs, error } = usePluginCosts(projectPath, profile);
  // Costs are read with the table, so a null list is still in flight.
  const loadingCosts = costs == null && error == null;
  // The row whose switch is flipping, so the other rows stay live.
  const [busyId, setBusyId] = useState<string | null>(null);
  const mutation = useMutationRunner();
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const byId = costsById(costs);

  const handleSort = (key: SortKey): void => {
    setSort(toggleSort(sort, key));
  };

  const toggle = async (plugin: InstalledPlugin): Promise<void> => {
    setBusyId(plugin.id);
    await mutation.run(() => {
      return onToggle(plugin);
    });
    setBusyId(null);
  };
  const shownError = mutation.error.length > 0 ? mutation.error : error;

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
      <p className="pb-2 text-body text-muted-foreground">
        {costs?.length === 0 ? t('costsNone') : t('costsExplainer')}
      </p>
      <table className={TABLE}>
        <thead>
          <tr>
            {COLUMNS.map((column) => {
              return (
                <SortHead
                  key={column.key}
                  sortKey={column.key}
                  sort={sort}
                  onSort={handleSort}
                  className={column.className}
                >
                  {t(column.labelKey)}
                </SortHead>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {ordered(plugins, byId, sort).map((plugin) => {
            const cost = byId.get(plugin.id);
            /* v8 ignore next -- splitting on a literal separator always yields index 0 */
            const name = plugin.id.split('@')[0] ?? plugin.id;

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
                    <span className="block truncate text-figure text-warn">
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
                  {/* The shared Switch primitive, so the "on" state tracks the
                      accent like every other switch rather than a fixed --ok. */}
                  <span className="flex items-center gap-1.5 text-figure">
                    <Switch
                      checked={plugin.enabled}
                      disabled={busyId === plugin.id}
                      onChange={() => {
                        void toggle(plugin);
                      }}
                      label={name}
                    />
                    <span className="text-muted-foreground">
                      {plugin.enabled ? t('stateOn') : t('stateOff')}
                    </span>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {shownError != null && (
        <p className="mt-1 text-xs text-warn">{shownError}</p>
      )}
    </section>
  );
};
