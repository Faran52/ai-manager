/*
 * Stores write an epoch in whatever unit their language reached for: seconds,
 * milliseconds, microseconds or nanoseconds. Magnitude is the only thing that
 * separates them, and getting it wrong is silent: a microsecond epoch reads as
 * the year 57971, and a nanosecond one is outside Date's range, so toISOString
 * throws and the decoders above catch that as an empty session rather than as
 * one turn with no timestamp.
 */
const SECONDS_CEILING = 10_000_000_000;
const MILLIS_CEILING = 10_000_000_000_000;
const MICROS_CEILING = 10_000_000_000_000_000;
const MAX_DATE_MS = 8_640_000_000_000_000;

// 1973. Below it the number is a count that happened to sit in a column the
// generic table reader looks at for a date, not a date.
const MIN_PLAUSIBLE_MS = 100_000_000_000;

const scaled = (value: number): number => {
  if (value < SECONDS_CEILING) {
    return value * 1000;
  }

  if (value < MILLIS_CEILING) {
    return value;
  }

  if (value < MICROS_CEILING) {
    return value / 1000;
  }

  return value / 1_000_000;
};

export const epochMillis = (value: number): number | undefined => {
  if (!Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  const millis = scaled(value);

  return millis >= MIN_PLAUSIBLE_MS && millis <= MAX_DATE_MS ? millis : undefined;
};
