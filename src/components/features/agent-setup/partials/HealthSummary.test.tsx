import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { HealthSummary } from './HealthSummary';

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

test('reads out the four facts with a trusted, known project', () => {
  render(
    <HealthSummary
      configured={2}
      total={5}
      findingCount={3}
      trust={{
        known: true,
        trusted: true,
        onboarded: true,
      }}
      usage={USAGE}
    />,
  );

  expect(screen.getByText('2/5')).toBeDefined();
  expect(screen.getByText('$12.50')).toBeDefined();
  expect(screen.getByText('Trusted')).toBeDefined();
  expect(screen.getByText('3')).toBeDefined();
});

test('calls a known but untrusted project restricted', () => {
  render(
    <HealthSummary
      configured={1}
      total={1}
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

test('leaves spend blank and trust unknown before anything is recorded', () => {
  render(
    <HealthSummary
      configured={0}
      total={4}
      findingCount={0}
      trust={{
        known: false,
        trusted: false,
        onboarded: false,
      }}
      usage={null}
    />,
  );

  expect(screen.getByText('Unknown')).toBeDefined();
  expect(screen.getByText('—')).toBeDefined();
  expect(screen.getByText('Not recorded')).toBeDefined();
});
