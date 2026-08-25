import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { ProjectTrustCard } from './ProjectTrustCard';

test('stays silent for a project that is known and trusted', () => {
  const { container } = render(
    <ProjectTrustCard trust={{
      known: true,
      trusted: true,
      onboarded: true,
    }}
    />,
  );

  expect(container.firstChild).toBeNull();
});

test('warns when a known project was never trusted', () => {
  render(
    <ProjectTrustCard trust={{
      known: true,
      trusted: false,
      onboarded: true,
    }}
    />,
  );

  expect(screen.getByText(/never trusted/u)).toBeDefined();
});

test('explains when Claude Code has no record of the project', () => {
  render(
    <ProjectTrustCard trust={{
      known: false,
      trusted: false,
      onboarded: true,
    }}
    />,
  );

  expect(screen.getByText(/no record of this project/u)).toBeDefined();
});
