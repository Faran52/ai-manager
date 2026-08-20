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

export const formatTimeAgo = (timestampMs: number, nowMs: number): string => {
  const elapsed = nowMs - timestampMs;

  if (elapsed < MINUTE_MS) {
    return 'just now';
  }

  if (elapsed < HOUR_MS) {
    const minutes = Math.floor(elapsed / MINUTE_MS);

    return `${String(minutes)}m ago`;
  }

  if (elapsed < DAY_MS) {
    const hours = Math.floor(elapsed / HOUR_MS);

    return `${String(hours)}h ago`;
  }

  const days = Math.floor(elapsed / DAY_MS);

  if (days < 30) {
    return `${String(days)}d ago`;
  }

  return new Date(timestampMs).toLocaleDateString('en-GB', {
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
