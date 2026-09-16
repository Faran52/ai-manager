import { act, renderHook } from '@testing-library/react';
import {
  describe,
  expect,
  test,
} from 'vitest';

import { useMutationRunner } from './useMutationRunner';

describe('useMutationRunner', () => {
  test('reports a clean action as done and clears any earlier error', async () => {
    const { result } = renderHook(() => {
      return useMutationRunner();
    });

    let outcome = false;

    await act(async () => {
      outcome = await result.current.run(() => {
        return Promise.reject(new Error('rename denied'));
      });
    });
    expect(outcome).toBe(false);
    expect(result.current.error).toBe('rename denied');

    await act(async () => {
      outcome = await result.current.run(() => {
        return Promise.resolve();
      });
    });
    expect(outcome).toBe(true);
    expect(result.current.error).toBe('');
    expect(result.current.busy).toBe(false);
  });
});

test('clears a stale error on request', async () => {
  const { result } = renderHook(useMutationRunner);

  await act(async () => {
    await result.current.run(() => {
      return Promise.reject(new Error('nope'));
    });
  });
  expect(result.current.error).toBe('nope');

  act(() => {
    result.current.clear();
  });
  expect(result.current.error).toBe('');
});
