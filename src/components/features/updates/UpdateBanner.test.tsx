import {
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach,
  describe,
  expect,
  test,
} from 'vitest';

import { UpdateBanner } from './UpdateBanner';

const stubUpdater = (checkForUpdate: () => Promise<DesktopUpdate>): void => {
  Object.defineProperty(window, 'bindings', {
    configurable: true,
    value: {
      desktopPlatform: () => {
        return Promise.resolve('darwin');
      },
      setApplicationMenu: () => {
        return Promise.resolve(undefined);
      },
      checkForUpdate,
    },
  });
};

afterEach(() => {
  Reflect.deleteProperty(window, 'bindings');
  localStorage.clear();
});

describe('UpdateBanner', () => {
  test('announces an available release and can be dismissed', async () => {
    stubUpdater(() => {
      return Promise.resolve({
        available: true,
        version: '2.1.0',
      });
    });

    render(<UpdateBanner />);

    await screen.findByText('Version 2.1.0 is available');

    await userEvent.click(screen.getByRole('button', { name: 'Later' }));

    expect(screen.queryByText('Version 2.1.0 is available')).toBeNull();
  });

  test('stays hidden when there is nothing to install', async () => {
    stubUpdater(() => {
      return Promise.resolve({ available: false });
    });

    render(<UpdateBanner />);

    await waitFor(() => {
      expect(document.querySelector('[data-update-banner]')).toBeNull();
    });
  });

  test('stays hidden when the check fails', async () => {
    stubUpdater(() => {
      return Promise.reject(new Error('offline'));
    });

    render(<UpdateBanner />);

    await waitFor(() => {
      expect(document.querySelector('[data-update-banner]')).toBeNull();
    });
  });

  test('asks nothing in a browser, which has no build of its own to replace', async () => {
    Reflect.deleteProperty(window, 'bindings');

    render(<UpdateBanner />);

    await waitFor(() => {
      expect(document.querySelector('[data-update-banner]')).toBeNull();
    });
  });
});
