import { median, summarizePricing } from './pricingUtils';

test('prices missing costs from the median observed rate for the same model', () => {
  const summary = summarizePricing([
    {
      model: 'priced',
      inputTokens: 100,
      outputTokens: 0,
      costUsd: 1,
    },
    {
      model: 'priced',
      inputTokens: 100,
      outputTokens: 0,
      costUsd: 1,
    },
    {
      model: 'priced',
      inputTokens: 100,
      outputTokens: 0,
      costUsd: 100,
    },
    {
      model: 'priced',
      inputTokens: 50,
      outputTokens: 50,
    },
  ]);

  expect(summary.models[0]).toEqual({
    model: 'priced',
    requests: 4,
    inputTokens: 350,
    outputTokens: 50,
    costUsd: 103,
    basis: 'estimated',
  });
});

test('keeps a model without an observed rate unpriced and omits its cost', () => {
  const summary = summarizePricing([
    {
      model: 'unknown',
      inputTokens: 20,
      outputTokens: 10,
    },
  ]);

  expect(summary.models[0]).toEqual({
    model: 'unknown',
    requests: 1,
    inputTokens: 20,
    outputTokens: 10,
    basis: 'unpriced',
  });
  expect(summary.costUsd).toBe(0);
});

test('reports exact pricing when every token-bearing entry reports cost', () => {
  const summary = summarizePricing([
    {
      model: 'exact',
      inputTokens: 2,
      outputTokens: 3,
      costUsd: 0.5,
    },
  ]);

  expect(summary.models[0]?.basis).toBe('exact');
  expect(summary.models[0]?.costUsd).toBe(0.5);
  expect(summary.coveragePercent).toBe(100);
});

test('guards invalid tokens and costs without producing invalid arithmetic', () => {
  const summary = summarizePricing([
    {
      model: 'guarded',
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 1,
    },
    {
      model: 'guarded',
      inputTokens: -1,
      outputTokens: Number.NaN,
      costUsd: -1,
    },
  ]);

  expect(summary.models[0]?.basis).toBe('unpriced');
  expect(summary.models[0]?.costUsd).toBeUndefined();
  expect(summary.coveragePercent).toBe(0);
  expect(Number.isFinite(summary.costUsd)).toBe(true);
  expect(summary.costUsd).toBeGreaterThanOrEqual(0);
});

test('reports priced token coverage at zero, a partial share, and one hundred percent', () => {
  expect(summarizePricing([
    {
      model: 'none',
      inputTokens: 10,
      outputTokens: 0,
    },
  ]).coveragePercent).toBe(0);
  expect(summarizePricing([
    {
      model: 'priced',
      inputTokens: 30,
      outputTokens: 0,
      costUsd: 3,
    },
    {
      model: 'none',
      inputTokens: 70,
      outputTokens: 0,
    },
  ]).coveragePercent).toBe(30);
  expect(summarizePricing([
    {
      model: 'all',
      inputTokens: 10,
      outputTokens: 0,
      costUsd: 1,
    },
  ]).coveragePercent).toBe(100);
});

test('takes the midpoint for an even sample and ignores invalid values', () => {
  expect(median([Number.NaN, -1, 2, 4])).toBe(3);
  expect(median([])).toBeUndefined();
});
