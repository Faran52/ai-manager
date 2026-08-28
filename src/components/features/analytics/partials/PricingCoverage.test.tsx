import { render, screen } from '@testing-library/react';

import { PricingCoverage } from './PricingCoverage';

import type { StatsTotals } from '@services/stats/statsService';

const totals = (coverage: number, unpricedModels: number): StatsTotals => {
  return {
    usageRecorded: true,
    sessions: 0,
    messages: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    conversationTokens: 0,
    nonConversationTokens: 0,
    billingTokens: 0,
    splitUnavailable: false,
    pricingCoveragePercent: coverage,
    unpricedModelCount: unpricedModels,
    costUsd: 0,
    durationMs: 0,
  };
};

test('shows populated pricing coverage', () => {
  render(<PricingCoverage totals={totals(82.25, 1)} />);

  expect(screen.getByText('82.3%')).toBeDefined();
  expect(screen.getByText('1')).toBeDefined();
});

test('shows an empty pricing state', () => {
  render(<PricingCoverage totals={totals(0, 0)} />);

  expect(screen.getByText('0.0%')).toBeDefined();
  expect(screen.getByText('0')).toBeDefined();
});

test('surfaces multiple unpriced models', () => {
  render(<PricingCoverage totals={totals(0, 3)} />);

  expect(screen.getByText('3')).toBeDefined();
});

test('defaults missing coverage fields for a legacy project payload', () => {
  const legacy: StatsTotals = {
    usageRecorded: true,
    sessions: 0,
    messages: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    costUsd: 0,
    durationMs: 0,
  };

  render(<PricingCoverage totals={legacy} />);

  expect(screen.getByText('0.0%')).toBeDefined();
  expect(screen.getByText('0')).toBeDefined();
});
