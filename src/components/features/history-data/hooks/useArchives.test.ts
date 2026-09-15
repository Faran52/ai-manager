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

import { useArchives } from './useArchives';

afterEach(() => {
  vi.unstubAllGlobals();
});

const archive = {
  id: '2026-07-01T00-00-00-000Z',
  createdMs: 1,
  note: '',
  sessionCount: 1,
  sizeBytes: 10,
  agents: ['claude'],
  projectKeys: ['claude:proj'],
};

describe('useArchives', () => {
  test('loads archives and reloads on request', async () => {
    const fetchMock = vi.fn(() => {
      return Response.json({ archives: [archive] });
    });

    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => {
      return useArchives(true);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    expect(result.current.data).toEqual([archive]);

    act(() => {
      result.current.reload();
    });

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    });
  });
});
