import {
  act,
  fireEvent,
  renderHook,
} from '@testing-library/react';
import {
  describe,
  expect,
  test,
} from 'vitest';

import { useSessionSelection } from './useSessionSelection';

import type { SessionSummary } from '@services/history/historyService';

interface PausedProps {
  readonly paused: boolean;
}

const session = (id: string, agent: SessionSummary['agent'] = 'claude'): SessionSummary => {
  return {
    agent,
    actualSessionId: id,
    id,
    filePath: `/r/${id}.jsonl`,
    projectId: 'p',
    messageCount: 1,
    firstTimestampMs: 0,
    lastTimestampMs: 0,
    modifiedMs: 0,
    sizeBytes: 1,
  };
};

const FIRST = session('a');
const ALL = [FIRST, session('b'), session('c', 'cursor')];

describe('useSessionSelection', () => {
  test('picks rows one at a time, or every deletable one at once', () => {
    const { result } = renderHook(() => {
      return useSessionSelection(ALL, ALL, false);
    });

    act(() => {
      result.current.enter();
      result.current.toggle(FIRST);
    });
    expect(result.current.active).toBe(true);
    expect(result.current.selectedSessions.map((entry) => {
      return entry.id;
    })).toEqual(['a']);

    act(() => {
      result.current.toggleAll();
    });
    expect(result.current.selectedPaths).toEqual(['/r/a.jsonl', '/r/b.jsonl']);
    expect(result.current.allSelected).toBe(true);

    act(() => {
      result.current.toggleAll();
      result.current.toggle(FIRST);
      result.current.toggle(FIRST);
    });
    expect(result.current.selectedPaths).toEqual([]);
  });

  test('leaves on Escape unless a dialog above it holds the key', () => {
    const { result, rerender } = renderHook(({ paused }: PausedProps) => {
      return useSessionSelection(ALL, ALL, paused);
    }, { initialProps: { paused: true } });

    act(() => {
      result.current.enter();
    });
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(result.current.active).toBe(true);

    rerender({ paused: false });
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(result.current.active).toBe(false);
  });
});
