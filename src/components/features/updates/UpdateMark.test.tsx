import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { appConfig } from '@config/appConfig';

import { UpdateMark } from './UpdateMark';

test('reads the installed version until a download starts', () => {
  const { rerender } = render(<UpdateMark stage="idle" />);

  expect(screen.getByText(appConfig.version)).toBeDefined();
  expect(screen.queryByRole('progressbar')).toBeNull();

  rerender(<UpdateMark stage="downloading" progress={0.4} />);

  const ring = screen.getByRole('progressbar');

  expect(ring.getAttribute('aria-valuenow')).toBe('40');
  expect(ring.getAttribute('aria-label')).toBe('Downloading update… 40%');
  expect(screen.queryByText(appConfig.version)).toBeNull();
});

test('draws an empty ring where the release names no size', () => {
  render(<UpdateMark stage="downloading" />);

  const ring = screen.getByRole('progressbar');

  expect(ring.getAttribute('aria-valuenow')).toBeNull();
  expect(ring.getAttribute('aria-label')).toBe('Downloading update…');
});
