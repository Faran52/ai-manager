import type { RhythmSlot } from '../partials/RhythmStrip';

/*
 * Every hour carries its own label. Labelling only some of them meant counting
 * along the row to work out which bar was which, which is the thing a label is
 * supposed to save you from.
 */
export const hourSlots = (counts: readonly number[]): RhythmSlot[] => {
  return counts.map((count, hour) => {
    return {
      key: String(hour),
      label: `${String(hour)}:00`,
      tick: String(hour).padStart(2, '0'),
      count,
    };
  });
};
