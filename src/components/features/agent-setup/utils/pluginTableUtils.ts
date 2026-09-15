import {
  PER_TURNS,
  SHA,
  TOKENS,
} from '../constants';

import type { InstalledPlugin, PluginCostAttribution } from '@services/agents/agentsService';
import type { SortKey, SortState } from '../partials/SortHead';

type Comparator = (
  left: InstalledPlugin,
  right: InstalledPlugin,
  byId: ReadonlyMap<string, PluginCostAttribution>,
) => number;

type CostField = 'alwaysOnTokens' | 'estimatedCostUsd' | 'onInvokeTokens';

export const tokensIn = (value: number): string => {
  return value === 0 ? '·' : TOKENS.format(value);
};

/*
 * Always-on context is re-sent on every turn, so a plugin costs a fraction of a
 * cent each time and four decimals rounded most of them to $0.0000. A thousand
 * turns is a scale worth acting on, and the per-turn figure stays in the title.
 */
export const costIn = (perTurnUsd: number): string => {
  return perTurnUsd <= 0 ? '·' : `$${(perTurnUsd * PER_TURNS).toFixed(2)}`;
};

/*
 * A commit id is not a version. Twelve hex characters crowd the column and say
 * no more than seven do, and a plugin with no version at all says nothing.
 */
export const versionIn = (version: string): string => {
  if (version === 'unknown' || version.length === 0) {
    return '·';
  }

  return SHA.test(version) ? version.slice(0, 7) : version;
};

export const costsById = (
  costs: readonly PluginCostAttribution[] | null,
): ReadonlyMap<string, PluginCostAttribution> => {
  return new Map((costs ?? []).map((cost) => {
    return [cost.plugin, cost];
  }));
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
    return left.id.localeCompare(right.id);
  },
  scope: (left, right) => {
    return left.scope.localeCompare(right.scope);
  },
  version: (left, right) => {
    return left.version.localeCompare(right.version);
  },
  alwaysOn: (left, right, byId) => {
    return costField(byId, left, 'alwaysOnTokens') - costField(byId, right, 'alwaysOnTokens');
  },
  perInvoke: (left, right, byId) => {
    return costField(byId, left, 'onInvokeTokens') - costField(byId, right, 'onInvokeTokens');
  },
  perTurns: (left, right, byId) => {
    return costField(byId, left, 'estimatedCostUsd') - costField(byId, right, 'estimatedCostUsd');
  },
  state: (left, right) => {
    return Number(left.enabled) - Number(right.enabled);
  },
};

// Position is identity, not status: a plugin keeps its row when toggled. The
// old rank-then-alphabetical order moved a row the instant its switch changed.
export const ordered = (
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

export const toggleSort = (current: SortState, key: SortKey): SortState => {
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
