import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { HealthHeader } from './HealthHeader';

import type { ProjectUsage } from '@services/agents/agentsService';

const USAGE: ProjectUsage = {
  costUsd: 12.5,
  inputTokens: 10,
  outputTokens: 20,
  cacheReadTokens: 30,
  durationMs: 1000,
  lastActiveMs: 0,
  models: [],
};

test('leads with the verdict, the counts and the spend on one line', () => {
  render(
    <HealthHeader
      configured={7}
      total={9}
      flagged={0}
      findingCount={0}
      trust={{
        known: true,
        trusted: true,
        onboarded: true,
      }}
      usage={USAGE}
    />,
  );

  expect(screen.getByRole('heading', { name: 'Configured agents look healthy' })).toBeDefined();
  expect(screen.getByText('7 of 9 set up · $12.50 recorded')).toBeDefined();
  expect(screen.getByText('Trusted')).toBeDefined();
  // Nothing is wrong, so no findings chip crowds the trust one.
  expect(screen.queryByText(/setup problem/u)).toBeNull();
});

test('turns the verdict and the findings chip over to the warning', () => {
  render(
    <HealthHeader
      configured={7}
      total={9}
      flagged={2}
      findingCount={3}
      trust={{
        known: true,
        trusted: true,
        onboarded: true,
      }}
      usage={USAGE}
    />,
  );

  expect(screen.getByRole('heading', { name: '2 agents need attention' })).toBeDefined();
  expect(screen.getByText('3 setup problems')).toBeDefined();
});

test('calls a known but untrusted project restricted', () => {
  render(
    <HealthHeader
      configured={1}
      total={1}
      flagged={0}
      findingCount={0}
      trust={{
        known: true,
        trusted: false,
        onboarded: true,
      }}
      usage={USAGE}
    />,
  );

  expect(screen.getByText('Restricted')).toBeDefined();
});

test('says the spend is unrecorded rather than calling it nothing', () => {
  render(
    <HealthHeader
      configured={0}
      total={4}
      flagged={0}
      findingCount={0}
      trust={{
        known: false,
        trusted: false,
        onboarded: false,
      }}
      usage={null}
    />,
  );

  expect(screen.getByText('0 of 4 set up · spend not recorded')).toBeDefined();
  expect(screen.getByText('Unknown')).toBeDefined();
});
