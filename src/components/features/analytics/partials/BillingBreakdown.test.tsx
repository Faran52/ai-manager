import { render, screen } from '@testing-library/react';

import { BillingBreakdown } from './BillingBreakdown';

import type { StatsTotals } from '@services/stats/statsService';

const totals = (overrides: Partial<StatsTotals> = {}): StatsTotals => {
  return {
    usageRecorded: true,
    sessions: 1,
    messages: 1,
    inputTokens: 60,
    outputTokens: 20,
    cacheCreationTokens: 10,
    cacheReadTokens: 10,
    conversationTokens: 80,
    nonConversationTokens: 20,
    billingTokens: 100,
    splitUnavailable: false,
    pricingCoveragePercent: 100,
    unpricedModelCount: 0,
    costUsd: 1,
    durationMs: 1,
    ...overrides,
  };
};

test('shows all billed token categories and their shares', () => {
  render(<BillingBreakdown totals={totals()} />);

  expect(screen.getByText('80% of billed tokens')).toBeDefined();
  expect(screen.getByText('20% of billed tokens')).toBeDefined();
  expect(screen.getByText('100% of billed tokens')).toBeDefined();
});

test('shows zero shares for empty billing data', () => {
  render(
    <BillingBreakdown totals={totals({
      conversationTokens: 0,
      nonConversationTokens: 0,
      billingTokens: 0,
    })}
    />,
  );

  expect(screen.getAllByText('0% of billed tokens')).toHaveLength(3);
});

test('explains when a real conversation split is unavailable', () => {
  render(<BillingBreakdown totals={totals({ splitUnavailable: true })} />);

  expect(screen.getByText(/does not record enough detail/)).toBeDefined();
});

test('derives the billing split for a legacy project payload', () => {
  render(
    <BillingBreakdown totals={{
      usageRecorded: true,
      sessions: 1,
      messages: 1,
      inputTokens: 5,
      outputTokens: 3,
      cacheCreationTokens: 1,
      cacheReadTokens: 1,
      costUsd: 0,
      durationMs: 0,
    }}
    />,
  );

  expect(screen.getByText('8')).toBeDefined();
  expect(screen.getByText('2')).toBeDefined();
  expect(screen.getByText('10')).toBeDefined();
});
