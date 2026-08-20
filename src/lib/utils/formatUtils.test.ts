import {
  describe,
  expect,
  test,
} from 'vitest';

import {
  formatCost,
  formatDateTime,
  formatDurationMs,
  formatTimeAgo,
  formatTokens,
  shortPath,
  sizeLabel,
  truncate,
} from './formatUtils';

describe('formatTokens', () => {
  test('keeps small counts as plain numbers', () => {
    expect(formatTokens(999)).toBe('999');
  });

  test('abbreviates thousands with one decimal below 10k', () => {
    expect(formatTokens(1_234)).toBe('1.2k');
    expect(formatTokens(12_345)).toBe('12k');
  });

  test('abbreviates millions', () => {
    expect(formatTokens(1_234_567)).toBe('1.2M');
    expect(formatTokens(12_000_000)).toBe('12M');
  });
});

describe('formatCost', () => {
  test('shows sub-cent costs with a marker and rounds the rest', () => {
    expect(formatCost(0.001)).toBe('<$0.01');
    expect(formatCost(0.5)).toBe('$0.50');
    expect(formatCost(0)).toBe('$0.00');
  });
});

describe('formatDurationMs', () => {
  test('picks the friendliest unit', () => {
    expect(formatDurationMs(30_000)).toBe('30s');
    expect(formatDurationMs(120_000)).toBe('2m');
    expect(formatDurationMs(5_400_000)).toBe('1.5h');
  });
});

describe('formatTimeAgo', () => {
  const now = Date.UTC(2026, 0, 10, 12, 0, 0);

  test('buckets elapsed time into friendly labels', () => {
    expect(formatTimeAgo(now - 30_000, now)).toBe('just now');
    expect(formatTimeAgo(now - 5 * 60_000, now)).toBe('5m ago');
    expect(formatTimeAgo(now - 3 * 3_600_000, now)).toBe('3h ago');
    expect(formatTimeAgo(now - 2 * 86_400_000, now)).toBe('2d ago');
  });

  test('falls back to a date for older timestamps', () => {
    const label = formatTimeAgo(Date.UTC(2025, 5, 1), now);

    expect(label).toMatch(/2025/u);
  });
});

describe('formatDateTime', () => {
  test('renders day month year with time', () => {
    const label = formatDateTime(Date.UTC(2026, 2, 5, 14, 30));

    expect(label).toContain('2026');
  });
});

describe('formatTimeAgo boundaries', () => {
  const now = Date.UTC(2026, 0, 10, 12, 0, 0);

  test('uses dates beyond thirty days', () => {
    expect(formatTimeAgo(now - 31 * 86_400_000, now)).not.toBe('31d ago');
  });
});

describe('shortPath', () => {
  test('shows the path relative to the project when it lives inside it', () => {
    expect(shortPath('/work/app/CLAUDE.md', '/work/app')).toBe('CLAUDE.md');
    expect(shortPath('/work/app/rules/a.md', '/work/app')).toBe('rules/a.md');
  });

  test('keeps sibling directories intact instead of eating their prefix', () => {
    expect(shortPath('/work/app2/file.md', '/work/app')).toBe('/work/app2/file.md');
  });

  test('collapses the home directory to a tilde elsewhere', () => {
    expect(shortPath('/Users/faran/settings.json', '/work/app')).toBe('~/settings.json');
    expect(shortPath('/home/dev/settings.json', '')).toBe('~/settings.json');
  });

  test('leaves unrelated absolute paths untouched', () => {
    expect(shortPath('/opt/tool/config.json', '/work/app')).toBe('/opt/tool/config.json');
  });
});

describe('sizeLabel', () => {
  test('labels small files in bytes', () => {
    expect(sizeLabel(0)).toBe('0B');
    expect(sizeLabel(1023)).toBe('1023B');
  });

  test('labels files from one kilobyte up', () => {
    expect(sizeLabel(1024)).toBe('1KB');
    expect(sizeLabel(1600)).toBe('2KB');
  });

  test('labels large files in megabytes', () => {
    expect(sizeLabel(1024 * 1024)).toBe('1MB');
    expect(sizeLabel(5 * 1024 * 1024 + 400_000)).toBe('5MB');
  });
});

describe('truncate boundaries', () => {
  test('never returns more characters than asked for', () => {
    expect(truncate('abcde', 5)).toBe('abcde');
    expect(truncate('abcde', 4)).toBe('abc…');
    expect(truncate('abcde', 1)).toBe('…');
    expect(truncate('abcde', 0)).toBe('');
  });
});
