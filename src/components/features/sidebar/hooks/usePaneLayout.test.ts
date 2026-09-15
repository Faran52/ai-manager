import { act, renderHook } from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  test,
} from 'vitest';

import {
  projectsDrawerStorageKey,
  projectsPaneStorageKey,
  sessionsListStorageKey,
} from '@config/storageKeys';

import { PROJECTS_WIDTH, usePaneLayout } from './usePaneLayout';

afterEach(() => {
  localStorage.clear();
});

describe('usePaneLayout', () => {
  test('starts from the stored widths and open flags, clamped to range', () => {
    localStorage.setItem(projectsPaneStorageKey, '999');
    localStorage.setItem(projectsDrawerStorageKey, 'false');

    const { result } = renderHook(() => {
      return usePaneLayout();
    });

    expect(result.current.projectsWidth).toBe(PROJECTS_WIDTH.max);
    expect(result.current.projectsOpen).toBe(false);
    expect(result.current.sessionsOpen).toBe(true);
  });

  test('falls back when nothing usable is stored', () => {
    localStorage.setItem(projectsPaneStorageKey, 'garbage');

    const { result } = renderHook(() => {
      return usePaneLayout();
    });

    expect(result.current.projectsWidth).toBe(PROJECTS_WIDTH.fallback);
  });

  test('resizes within range and remembers the result', () => {
    const { result } = renderHook(() => {
      return usePaneLayout();
    });

    act(() => {
      result.current.resizeProjects(-1000);
      result.current.resizeSessions(20);
      result.current.setSessionsOpen(false);
    });

    expect(result.current.projectsWidth).toBe(PROJECTS_WIDTH.min);
    expect(result.current.sessionsWidth).toBe(340);
    expect(localStorage.getItem(projectsPaneStorageKey)).toBe(String(PROJECTS_WIDTH.min));
    expect(localStorage.getItem(sessionsListStorageKey)).toBe('false');
  });
});
