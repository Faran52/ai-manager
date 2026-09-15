import {
  act,
  renderHook,
  waitFor,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { useStorage } from './useStorage';

afterEach(() => {
  vi.unstubAllGlobals();
});

const report = {
  agents: [],
  totalBytes: 0,
  partial: false,
};

describe('useStorage', () => {
  test('loads the report and reloads on request', async () => {
    const fetchMock = vi.fn(() => {
      return Response.json(report);
    });

    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => {
      return useStorage(true);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    act(() => {
      result.current.reload();
    });

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    });
  });
});
