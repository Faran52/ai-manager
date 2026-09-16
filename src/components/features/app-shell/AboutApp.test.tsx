import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach,
  expect,
  test,
  vi,
} from 'vitest';

import { appConfig } from '@config/appConfig';

import { AboutApp } from './AboutApp';

afterEach(() => {
  vi.unstubAllGlobals();
});

test('fills its own window with what the app says about itself', () => {
  render(<AboutApp />);

  expect(document.querySelector('[data-about-window]')).not.toBeNull();
  expect(screen.getByText('AI Manager')).toBeDefined();
  expect(screen.getByText(appConfig.version)).toBeDefined();
});

test('asks the feed itself, sharing nothing with the window that opened it', async () => {
  vi.stubGlobal('fetch', vi.fn(() => {
    return Response.json({ update: { stage: 'none' } });
  }));

  render(<AboutApp />);

  await userEvent.click(screen.getByText(/Check for Updates/));

  expect(await screen.findByText('You are up to date')).toBeDefined();
});
