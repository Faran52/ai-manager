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

import { useRetention } from './useRetention';

afterEach(() => {
  vi.unstubAllGlobals();
});

const retention = {
  policy: {
    enabled: false,
    olderThanDays: 30,
    agents: [],
  },
  due: {
    sessions: [],
  },
};

describe('useRetention', () => {
  test('loads retention status and reloads on request', async () => {
    const fetchMock = vi.fn(() => {
      return Response.json(retention);
    });

    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => {
      return useRetention(true);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    expect(result.current.data).toEqual(retention);

    act(() => {
      result.current.reload();
    });

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    });
  });
});
