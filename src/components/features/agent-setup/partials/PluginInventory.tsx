import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ChevronDown, ChevronUp } from 'lucide-react';

import { cn } from '@utils/cnUtils';
import { toErrorMessage } from '@utils/errorUtils';

import { Spinner, Switch } from '@ui/index';

import { usePluginCosts } from '../hooks/usePluginCosts';

import type { InstalledPlugin, PluginCostAttribution } from '@services/agents/agentsService';
import type { FC, ReactNode } from 'react';

export interface PluginInventoryProps {
  readonly plugins: readonly InstalledPlugin[];
  readonly projectPath: string;
  readonly onToggle: (plugin: InstalledPlugin) => Promise<void>;
}

type SortKey = 'alwaysOn' | 'perInvoke' | 'perTurns' | 'plugin' | 'scope' | 'state' | 'version';

type SortDirection = 'asc' | 'desc';

interface SortState {
  readonly key: SortKey;
  readonly direction: SortDirection;
}

type Comparator = (
  left: InstalledPlugin,
  right: InstalledPlugin,
  byId: ReadonlyMap<string, PluginCostAttribution>,
) => number;

interface SortHeadProps {
  readonly sortKey: SortKey;
  readonly sort: SortState;
  readonly onSort: (key: SortKey) => void;
  readonly className?: string;
  readonly children: ReactNode;
}

type CostField = 'alwaysOnTokens' | 'estimatedCostUsd' | 'onInvokeTokens';

const CELL = 'truncate py-2 pe-4 text-start align-middle';

/*
 * The state cell holds a control, not text: truncate would clip the switch and
 * paint a stray ellipsis beside it.
 */
const SWITCH_CELL = 'py-2 pe-4 text-start align-middle whitespace-nowrap';

const HEAD = cn(CELL, `
  sticky top-0 z-10 bg-popover text-figure font-medium tracking-wider
  text-muted-foreground uppercase
`);
const NUMERIC = 'text-end';
const TABLE = 'w-full table-fixed border-collapse font-mono text-body';
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

const costsById = (
  costs: readonly PluginCostAttribution[] | null,
): ReadonlyMap<string, PluginCostAttribution> => {
  return new Map((costs ?? []).map((cost) => {
    return [cost.plugin, cost];
  }));
};

const DEFAULT_SORT: SortState = {
  key: 'plugin',
  direction: 'asc',
};

const compareText = (left: string, right: string): number => {
  return left.localeCompare(right);
};

const compareNumber = (left: number, right: number): number => {
  return left - right;
};

const stateValue = (plugin: InstalledPlugin): number => {
  return plugin.enabled ? 1 : 0;
};

// A plugin the cost read never attributed anything to sorts as a plain zero.
const costField = (
  byId: ReadonlyMap<string, PluginCostAttribution>,
  plugin: InstalledPlugin,
  field: CostField,
): number => {
  return byId.get(plugin.id)?.[field] ?? 0;
};

const COMPARATORS: Record<SortKey, Comparator> = {
  plugin: (left, right) => {
    return compareText(left.id, right.id);
  },
  scope: (left, right) => {
    return compareText(left.scope, right.scope);
  },
  version: (left, right) => {
    return compareText(left.version, right.version);
  },
  alwaysOn: (left, right, byId) => {
    return compareNumber(costField(byId, left, 'alwaysOnTokens'), costField(byId, right, 'alwaysOnTokens'));
  },
  perInvoke: (left, right, byId) => {
    return compareNumber(costField(byId, left, 'onInvokeTokens'), costField(byId, right, 'onInvokeTokens'));
  },
  perTurns: (left, right, byId) => {
    return compareNumber(costField(byId, left, 'estimatedCostUsd'), costField(byId, right, 'estimatedCostUsd'));
  },
  state: (left, right) => {
    return compareNumber(stateValue(left), stateValue(right));
  },
};

/*
 * Position is identity, not status: a plugin keeps its row when it is toggled
 * on or off, sorted only by whatever column the reader picked (the plugin's
 * own name by default). The old rank-then-alphabetical order moved a row the
 * instant its switch changed, which read as the table losing track of it.
 */
const ordered = (
  plugins: readonly InstalledPlugin[],
  byId: ReadonlyMap<string, PluginCostAttribution>,
  sort: SortState,
): readonly InstalledPlugin[] => {
  const sign = sort.direction === 'asc' ? 1 : -1;
  const compare = COMPARATORS[sort.key];

  return [...plugins].sort((left, right) => {
    const primary = compare(left, right, byId);

    return primary === 0 ? left.id.localeCompare(right.id) : primary * sign;
  });
};

const toggleSort = (current: SortState, key: SortKey): SortState => {
  if (current.key !== key) {
    return {
      key,
      direction: 'asc',
    };
  }

  return {
    key,
    direction: current.direction === 'asc' ? 'desc' : 'asc',
  };
};

const ariaSortFor = (key: SortKey, sort: SortState): 'ascending' | 'descending' | 'none' => {
  if (sort.key !== key) {
    return 'none';
  }

  return sort.direction === 'asc' ? 'ascending' : 'descending';
};

const SortHead: FC<SortHeadProps> = ({
  sortKey,
  sort,
  onSort,
  className,
  children,
}) => {
  const active = sort.key === sortKey;
  const Icon = sort.direction === 'asc' ? ChevronUp : ChevronDown;

  return (
    <th scope="col" aria-sort={ariaSortFor(sortKey, sort)} className={className}>
      <button
        type="button"
        onClick={() => {
          onSort(sortKey);
        }}
        className="inline-flex items-center gap-0.5"
      >
        {children}
        {active && <Icon className="size-3" />}
      </button>
    </th>
  );
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
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const byId = costsById(costs);

  const handleSort = (key: SortKey): void => {
    setSort(toggleSort(sort, key));
  };

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
      <p className="pb-2 text-body text-muted-foreground">
        {costs?.length === 0 ? t('costsNone') : t('costsExplainer')}
      </p>
      <table className={TABLE}>
        <thead>
          <tr>
            <SortHead
              sortKey="plugin"
              sort={sort}
              onSort={handleSort}
              className={cn(HEAD, 'w-[26%] ps-2')}
            >
              {t('plugin')}
            </SortHead>
            <SortHead
              sortKey="scope"
              sort={sort}
              onSort={handleSort}
              className={cn(HEAD, 'w-[10%]')}
            >
              {t('scope')}
            </SortHead>
            <SortHead
              sortKey="version"
              sort={sort}
              onSort={handleSort}
              className={cn(HEAD, 'w-[13%]')}
            >
              {t('version')}
            </SortHead>
            <SortHead
              sortKey="alwaysOn"
              sort={sort}
              onSort={handleSort}
              className={cn(HEAD, NUMERIC, 'w-[13%]')}
            >
              {t('costsAlwaysOn')}
            </SortHead>
            <SortHead
              sortKey="perInvoke"
              sort={sort}
              onSort={handleSort}
              className={cn(HEAD, NUMERIC, 'w-[13%]')}
            >
              {t('costsPerInvoke')}
            </SortHead>
            <SortHead
              sortKey="perTurns"
              sort={sort}
              onSort={handleSort}
              className={cn(HEAD, NUMERIC, 'w-[15%]')}
            >
              {t('costsPerTurns')}
            </SortHead>
            <SortHead
              sortKey="state"
              sort={sort}
              onSort={handleSort}
              className={cn(HEAD, 'w-[10%]')}
            >
              {t('state')}
            </SortHead>
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
      {(actionError ?? error) != null && (
        <p className="mt-1 text-xs text-warn">{actionError ?? error}</p>
      )}
    </section>
  );
};
