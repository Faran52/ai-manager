import { act, renderHook } from '@testing-library/react';
import {
  describe,
  expect,
  test,
} from 'vitest';

import { useAnalyticsScope } from './useAnalyticsScope';

describe('useAnalyticsScope', () => {
  test('opens on the project already chosen', () => {
    const { result } = renderHook(() => {
      return useAnalyticsScope('claude:webapp');
    });

    expect(result.current.scope).toBe('project');
  });

  test('opens on the whole machine when nothing has been chosen', () => {
    const { result } = renderHook(() => {
      return useAnalyticsScope('');
    });

    expect(result.current.scope).toBe('global');
  });

  test('follows a project chosen later', () => {
    const { result, rerender } = renderHook((key: string) => {
      return useAnalyticsScope(key);
    }, { initialProps: '' });

    rerender('claude:webapp');

    expect(result.current.scope).toBe('project');
  });

  test('keeps the whole machine in view until the project changes', () => {
    const { result, rerender } = renderHook((key: string) => {
      return useAnalyticsScope(key);
    }, { initialProps: 'claude:webapp' });

    act(() => {
      result.current.setScope('global');
    });

    rerender('claude:webapp');
    expect(result.current.scope).toBe('global');

    rerender('claude:other');
    expect(result.current.scope).toBe('project');
  });
});
