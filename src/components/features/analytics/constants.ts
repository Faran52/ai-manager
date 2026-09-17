/*
 * Cells and the legend read this one list, so the key cannot drift from the
 * grid. It tracks the accent rather than --ok, which would ignore the reader
 * choice in Settings. Idle is --recess so quiet and nothing look different.
 */
export const WASH_SCALE = ['bg-recess', 'bg-primary/40', 'bg-primary/70', 'bg-primary'] as const;

export const IDLE_CLASS = WASH_SCALE[0];

/*
 * About two months. The grid stretches to whatever card it is given, so the span
 * decides how coarse the picture is, not how much of the card goes unused.
 */
export const WEEKS_SHOWN = 9;

export const DAYS_IN_WEEK = 7;

export const MS_PER_DAY = 24 * 60 * 60 * 1000;
