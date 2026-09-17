import type { RhythmSlot } from '../partials/RhythmStrip';

/*
 * Every hour carries its own label. Labelling only some meant counting along the
 * row to work out which bar was which.
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
