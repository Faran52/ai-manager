import type { ToolUsage } from '@services/stats/statsService';
import type { BarListProps } from '../partials/BarList';

// The three usage lists read from the same ranked shape, and ten bars is as
// deep as a card of them stays legible.
export const usageItems = (usage: readonly ToolUsage[]): BarListProps['items'] => {
  return usage.slice(0, 10).map((entry) => {
    return {
      label: entry.tool,
      value: entry.count,
    };
  });
};
