import { render, screen } from '@testing-library/react';

import { ProviderDistribution } from './ProviderDistribution';

test('shows providers ordered with token shares and scope counts', () => {
  render(
    <ProviderDistribution agents={[
      {
        agent: 'claude',
        tokens: 75,
        sessions: 3,
        projects: 2,
      },
      {
        agent: 'codex',
        tokens: 25,
        sessions: 1,
        projects: 1,
      },
    ]}
    />,
  );

  expect(screen.getByText('Claude Code · 3 sessions · 2 projects')).toBeDefined();
  expect(screen.getByText('75 · 75%')).toBeDefined();
  expect(screen.getByText('25 · 25%')).toBeDefined();
});

test('shows an empty provider state', () => {
  render(<ProviderDistribution agents={[]} />);

  expect(screen.getByText('No provider usage recorded.')).toBeDefined();
});

test('shows zero share without invalid arithmetic when providers have no tokens', () => {
  render(
    <ProviderDistribution agents={[{
      agent: 'claude',
      tokens: 0,
      sessions: 1,
      projects: 1,
    }]}
    />,
  );

  expect(screen.getByText('0 · 0%')).toBeDefined();
});
