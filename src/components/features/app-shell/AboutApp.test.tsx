import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach,
  expect,
  test,
} from 'vitest';

import { appConfig } from '@config/appConfig';

import { AboutApp } from './AboutApp';

afterEach(() => {
  Reflect.deleteProperty(window, 'bindings');
});

test('fills its own window with what the app says about itself', () => {
  render(<AboutApp />);

  expect(document.querySelector('[data-about-window]')).not.toBeNull();
  expect(screen.getByText('AI Manager')).toBeDefined();
  expect(screen.getByText((text) => {
    return text.includes(appConfig.version) && text.includes(appConfig.buildCommit);
  })).toBeDefined();
});

test('asks the updater itself, sharing nothing with the window that opened it', async () => {
  Object.defineProperty(window, 'bindings', {
    configurable: true,
    value: {
      desktopPlatform: () => {
        return Promise.resolve('darwin');
      },
      setApplicationMenu: () => {
        return Promise.resolve(undefined);
      },
      checkForUpdate: () => {
        return Promise.resolve({ available: false });
      },
    },
  });

  render(<AboutApp />);

  await userEvent.click(screen.getByText(/Check for Updates/));

  expect(await screen.findByText('You are up to date')).toBeDefined();
});
