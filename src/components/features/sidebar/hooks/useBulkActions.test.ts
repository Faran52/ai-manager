import {
  act,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { toastWrapper } from '@mocks/toastHostFixtures';

import { useBulkActions } from './useBulkActions';

import type { SessionSummary } from '@services/history/historyService';

const SESSIONS: readonly SessionSummary[] = [{
  agent: 'claude',
  actualSessionId: 'a',
  id: 'a',
  filePath: '/r/a.jsonl',
  projectId: 'p',
  messageCount: 1,
  firstTimestampMs: 0,
  lastTimestampMs: 0,
  modifiedMs: 0,
  sizeBytes: 1,
}];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useBulkActions', () => {
  test('archives the picked sessions and says how many it saved', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return Response.json({ archive: { sessionCount: 1 } });
    }));

    const { result } = renderHook(() => {
      return useBulkActions(SESSIONS, 'webapp');
    }, { wrapper: toastWrapper });

    act(() => {
      result.current.archiveSelected();
    });

    expect(await screen.findByText('Archived 1 session')).toBeDefined();
    await waitFor(() => {
      expect(result.current.busy).toBe(false);
    });
  });

  test('reports an archive that failed', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return new Response('{"error":"disk full"}', { status: 500 });
    }));

    const { result } = renderHook(() => {
      return useBulkActions(SESSIONS, undefined);
    }, { wrapper: toastWrapper });

    act(() => {
      result.current.archiveSelected();
    });

    expect(await screen.findByText('disk full')).toBeDefined();
  });

  test('reports an export that could not read every transcript', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return new Response('{"error":"gone"}', { status: 500 });
    }));

    const { result } = renderHook(() => {
      return useBulkActions(SESSIONS, undefined);
    }, { wrapper: toastWrapper });

    act(() => {
      result.current.exportSelected();
    });

    expect(await screen.findByText('Could not export every selected session.')).toBeDefined();
  });
});
