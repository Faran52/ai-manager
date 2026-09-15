/*
 * The four washes, idle first. Cells and the legend both read this one list, so
 * the key under the grid can never drift from the grid. It tracks the accent
 * (--primary), not --ok: the heatmap is a mark the reader colours in Settings
 * like every bar in the report, and --ok is a fixed status colour that would
 * ignore that choice. Idle is --recess, a hole, so "quiet" and "nothing" look
 * different rather than both being the palest shade.
 */
export const WASH_SCALE = ['bg-recess', 'bg-primary/40', 'bg-primary/70', 'bg-primary'] as const;

export const IDLE_CLASS = WASH_SCALE[0];

/*
 * About two months. The grid stretches to whatever card it is given, in both
 * directions, so the span decides how coarse the picture is rather than how
 * much of the card goes unused.
 */
export const WEEKS_SHOWN = 9;

export const DAYS_IN_WEEK = 7;

export const MS_PER_DAY = 24 * 60 * 60 * 1000;
