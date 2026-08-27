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
  vi,
} from 'vitest';

import { UpdateBanner } from './UpdateBanner';

const respond = (update: object): void => {
  vi.stubGlobal('fetch', vi.fn(() => {
    return Promise.resolve(new Response(JSON.stringify({ update }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
  }));
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('UpdateBanner', () => {
  test('announces an available release and can be dismissed', async () => {
    respond({
      stage: 'available',
      version: '2.1.0',
    });

    render(<UpdateBanner />);

    await screen.findByText('Version 2.1.0 is available');

    await userEvent.click(screen.getByRole('button', { name: 'Later' }));

    expect(screen.queryByText('Version 2.1.0 is available')).toBeNull();
  });

  test('stays hidden when there is nothing to install', async () => {
    respond({ stage: 'idle' });

    render(<UpdateBanner />);

    await waitFor(() => {
      expect(screen.queryByTestId('update-banner')).toBeNull();
    });
    expect(document.querySelector('[data-update-banner]')).toBeNull();
  });

  test('stays hidden when the check fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return Promise.reject(new Error('offline'));
    }));

    render(<UpdateBanner />);

    await waitFor(() => {
      expect(document.querySelector('[data-update-banner]')).toBeNull();
    });
  });
});
