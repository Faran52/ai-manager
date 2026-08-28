const THOUSAND = 1_000;
const MILLION = 1_000_000;

export const formatTokens = (count: number): string => {
  if (count >= MILLION) {
    return `${(count / MILLION).toFixed(count >= 10 * MILLION ? 0 : 1)}M`;
  }

  if (count >= THOUSAND) {
    return `${(count / THOUSAND).toFixed(count >= 10 * THOUSAND ? 0 : 1)}k`;
  }

  return String(count);
};

const CENT = 0.01;

export const formatCost = (usd: number): string => {
  if (usd > 0 && usd < CENT) {
    return '<$0.01';
  }

  return `$${usd.toFixed(2)}`;
};

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export const formatDurationMs = (ms: number): string => {
  if (ms < MINUTE_MS) {
    return `${String(Math.round(ms / 1000))}s`;
  }

  if (ms < HOUR_MS) {
    return `${String(Math.round(ms / MINUTE_MS))}m`;
  }

  return `${(ms / HOUR_MS).toFixed(1)}h`;
};

export const formatDateTime = (timestampMs: number): string => {
  return new Date(timestampMs).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Fixed to en-GB like formatDateTime, so a transcript reads the same clock
// whatever locale the interface is in.
export const formatClock = (timestampMs: number): string => {
  return new Date(timestampMs).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

// The label a day separator carries. Today and yesterday are named rather than
// dated, because in a transcript those two are the ones being scanned for.
export const formatDayLabel = (timestampMs: number, nowMs: number, locale = 'en'): string => {
  const startOf = (value: number): number => {
    const date = new Date(value);

    date.setHours(0, 0, 0, 0);

    return date.getTime();
  };
  const days = Math.round((startOf(nowMs) - startOf(timestampMs)) / DAY_MS);

  if (days === 0 || days === 1) {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-days, 'day');
  }

  return new Date(timestampMs).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

// Intl carries each locale's wording, plurals and numerals, including the
// Arabic dual, so none of this needs translating by hand.
export const formatTimeAgo = (timestampMs: number, nowMs: number, locale = 'en'): string => {
  const elapsed = nowMs - timestampMs;

  if (elapsed < MINUTE_MS) {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(0, 'second');
  }

  const relative = new Intl.RelativeTimeFormat(locale, { style: 'narrow' });

  if (elapsed < HOUR_MS) {
    return relative.format(-Math.floor(elapsed / MINUTE_MS), 'minute');
  }

  if (elapsed < DAY_MS) {
    return relative.format(-Math.floor(elapsed / HOUR_MS), 'hour');
  }

  const days = Math.floor(elapsed / DAY_MS);

  if (days < 30) {
    return relative.format(-days, 'day');
  }

  return new Date(timestampMs).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export const truncate = (value: string, maxChars: number): string => {
  if (maxChars < 1) {
    return '';
  }

  return value.length <= maxChars ? value : `${value.slice(0, maxChars - 1)}…`;
};

export const singleLine = (value: string, maxChars: number): string => {
  return truncate(value.replace(/\s+/gu, ' ').trim(), maxChars);
};

const HOME_PREFIX = /^\/(?:Users|home)\/[^/]+/u;

// Shows a path relative to the project when it lives inside it, or `~/…` when inside the home directory.
export const shortPath = (path: string, projectPath: string): string => {
  if (projectPath.length > 0 && path.startsWith(`${projectPath}/`)) {
    return path.slice(projectPath.length + 1);
  }

  return path.replace(HOME_PREFIX, '~');
};

const KILOBYTE = 1024;
const MEGABYTE = KILOBYTE * 1024;

export const sizeLabel = (bytes: number): string => {
  if (bytes >= MEGABYTE) {
    return `${String(Math.round(bytes / MEGABYTE))}MB`;
  }

  return bytes < KILOBYTE ? `${String(bytes)}B` : `${String(Math.round(bytes / KILOBYTE))}KB`;
};
