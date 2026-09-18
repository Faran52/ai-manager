import {
  act,
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

import { stubUpdater } from '@mocks/updaterFixtures';

import { UpdateBanner } from './UpdateBanner';

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

  test('offers the install where the shell can swap its own bundle, and says so while it runs', async () => {
    let settle = (): void => {
      return undefined;
    };

    stubUpdater(() => {
      return Promise.resolve({
        available: true,
        version: '9.9.9',
      });
    }, () => {
      return new Promise<void>((resolve) => {
        settle = resolve;
      });
    });

    render(<UpdateBanner />);

    const install = await screen.findByRole('button', { name: 'Install and restart' });

    await userEvent.click(install);

    await waitFor(() => {
      expect(screen.getByText('Downloading update…')).not.toBeNull();
    });
    // The row holds the download rather than offering the buttons again.
    expect(screen.queryByRole('button', { name: 'Later' })).toBeNull();
    // Nothing to show until the shell reports a figure.
    expect(screen.queryByRole('progressbar')).toBeNull();

    act(() => {
      window.dispatchEvent(new CustomEvent('app-update-progress', { detail: 0.42 }));
    });

    const bar = await screen.findByRole('progressbar');

    expect(bar.getAttribute('aria-valuenow')).toBe('42');
    expect(screen.getByText('Downloading update… 42%')).not.toBeNull();

    settle();
  });

  test('offers no install button where the shell has no way to swap the bundle', async () => {
    stubUpdater(() => {
      return Promise.resolve({
        available: true,
        version: '9.9.9',
      });
    });

    render(<UpdateBanner />);

    await screen.findByRole('button', { name: 'Later' });
    expect(screen.queryByRole('button', { name: 'Install and restart' })).toBeNull();
  });
});
