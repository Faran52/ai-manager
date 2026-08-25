import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { ProjectUsageCard } from './ProjectUsageCard';

import type { ProjectUsage } from '@services/agents/agentsService';

const NOW = Date.UTC(2026, 0, 2);

const usage: ProjectUsage = {
  costUsd: 922.08,
  inputTokens: 1434526,
  outputTokens: 2886496,
  cacheReadTokens: 1367274458,
  durationMs: 151405585,
  lastActiveMs: Date.UTC(2026, 0, 1),
  models: [
    {
      model: 'claude-opus-5',
      inputTokens: 1366427,
      outputTokens: 2696593,
      cacheReadTokens: 1334227198,
      cacheCreationTokens: 23150371,
      costUsd: 906.31,
    },
    {
      model: 'claude-haiku-4-5',
      inputTokens: 1312,
      outputTokens: 598,
      cacheReadTokens: 0,
      cacheCreationTokens: 302847,
      costUsd: 0.38,
    },
  ],
};

test('shows spend, tokens and how current the figures are', () => {
  render(<ProjectUsageCard usage={usage} nowMs={NOW} />);

  expect(screen.getByText('Recorded usage')).toBeDefined();
  expect(screen.getByText(/last active/u)).toBeDefined();
  expect(screen.getByText('Spend')).toBeDefined();
  expect(screen.getByText('Cache reads')).toBeDefined();
});

test('breaks spend down per model', () => {
  render(<ProjectUsageCard usage={usage} nowMs={NOW} />);

  expect(screen.getByText('claude-opus-5')).toBeDefined();
  expect(screen.getByText('claude-haiku-4-5')).toBeDefined();
});

test('omits the model breakdown when none was recorded', () => {
  render(
    <ProjectUsageCard
      usage={{
        ...usage,
        models: [],
      }}
      nowMs={NOW}
    />,
  );

  expect(screen.getByText('Recorded usage')).toBeDefined();
  expect(screen.queryByText('claude-opus-5')).toBeNull();
});
