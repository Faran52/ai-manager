import { render, screen } from '@testing-library/react';

import { ModelDistribution } from './ModelDistribution';

test('shows exact and estimated model costs', () => {
  render(
    <ModelDistribution models={[
      {
        model: 'exact-model',
        requests: 1,
        inputTokens: 10,
        outputTokens: 5,
        costUsd: 1,
        basis: 'exact',
      },
      {
        model: 'estimated-model',
        requests: 1,
        inputTokens: 5,
        outputTokens: 5,
        costUsd: 0.5,
        basis: 'estimated',
      },
    ]}
    />,
  );

  expect(screen.getByText('EXACT')).toBeDefined();
  expect(screen.getByText('EST.')).toBeDefined();
  expect(screen.getByText('$1.00')).toBeDefined();
});

test('shows an empty model state', () => {
  render(<ModelDistribution models={[]} />);

  expect(screen.getByText('No model usage recorded.')).toBeDefined();
});

test('never displays an invented cost for unpriced models', () => {
  render(
    <ModelDistribution models={[
      {
        model: 'unknown-model',
        requests: 1,
        inputTokens: 10,
        outputTokens: 0,
        basis: 'unpriced',
      },
      {
        model: 'another-model',
        requests: 1,
        inputTokens: 5,
        outputTokens: 0,
        basis: 'unpriced',
      },
    ]}
    />,
  );

  expect(screen.getAllByText('unpriced')).toHaveLength(2);
  expect(screen.getAllByText('Cost unavailable')).toHaveLength(2);
});
