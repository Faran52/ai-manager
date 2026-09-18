// Magnitude is the only thing separating a seconds epoch from a nanosecond one,
// and guessing wrong is silent: year 57971, or a throw a caller reads as no session.
const SECONDS_CEILING = 10_000_000_000;
const MILLIS_CEILING = 10_000_000_000_000;
const MICROS_CEILING = 10_000_000_000_000_000;
const MAX_DATE_MS = 8_640_000_000_000_000;

// 1973. Below it the value is a count sitting in a column named date, not a date.
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
