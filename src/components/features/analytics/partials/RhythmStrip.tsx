import { motion } from 'motion/react';

import { maxOf } from '@utils/arrayUtils';
import { cn } from '@utils/cnUtils';
import { formatTokens } from '@utils/formatUtils';

import {
  fillTransition,
  MOTION_STAGGER,
  Tooltip,
} from '@ui/index';

import type { FC } from 'react';

export interface RhythmSlot {
  readonly key: string;
  readonly label: string;
  // Written under the bar, so a reader never has to count along the row.
  readonly tick: string;
  readonly count: number;
}

export interface RhythmStripProps {
  readonly slots: readonly RhythmSlot[];
  readonly caption: string;
}

// Total time for a whole strip to fill, shared out across however many bars it has.
const SWEEP = 0.4;

/*
 * A bar with nothing written under it says only that something happened, not
 * when. The labels were in the hover text alone, which is no use on a touch
 * screen and no use at a glance.
 */
export const RhythmStrip: FC<RhythmStripProps> = ({ slots, caption }) => {
  const peak = maxOf(slots, (slot) => {
    return slot.count;
  });
  /*
   * The sweep is shared rather than per bar, so 24 hours and 7 weekdays take
   * the same time to fill instead of the hours running three times longer.
   */
  const step = Math.min(MOTION_STAGGER, SWEEP / Math.max(1, slots.length));

  return (
    <div className="grid gap-1">
      <p className="text-body text-muted-foreground">{caption}</p>
      <div className="flex items-end gap-0.5" role="img" aria-label={caption}>
        {slots.map((slot, index) => {
          const percent = peak === 0 ? 0 : (slot.count / peak) * 100;
          const atPeak = peak > 0 && slot.count === peak;

          return (
            <div key={slot.key} className="grid min-w-0 flex-1 gap-1">
              <div className="flex h-16 items-end">
                {/*
                  * The column is given its height once and grown with a scale.
                  * Animating the height itself relaid out the row on every
                  * frame, and there are 24 of these beside a second chart.
                  */}
                <Tooltip content={`${slot.label}: ${formatTokens(slot.count)}`}>
                  <motion.div
                    data-rhythm-bar={slot.key}
                    // A style is not something a test should have to parse.
                    data-rhythm-height={percent}
                    data-rhythm-peak={atPeak || undefined}
                    className={cn(
                      'w-full origin-bottom rounded-t-sm',
                      atPeak ? 'bg-primary' : 'bg-primary/70',
                    )}
                    /*
                     * An hour that recorded nothing keeps a hairline rather than
                     * vanishing, so quiet and nothing stop looking alike and
                     * the row does not appear to close its gap.
                     */
                    style={{ height: percent === 0 ? '2px' : `${String(percent)}%` }}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{
                      ...fillTransition,
                      delay: index * step,
                    }}
                  />
                </Tooltip>
              </div>
              <span className="
                overflow-hidden text-center text-figure leading-none
                text-muted-foreground tabular-nums
              "
              >
                {slot.tick}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
