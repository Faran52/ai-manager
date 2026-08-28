import { act, renderHook } from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  test,
} from 'vitest';

import { accentNames, useAccent } from './useAccent';

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-accent');
});

describe('useAccent', () => {
  test('defaults to teal when nothing is stored', () => {
    const { result } = renderHook(() => {
      return useAccent();
    });

    expect(result.current.accent).toBe('teal');
  });

  test('reads a stored accent', () => {
    localStorage.setItem('acm-accent', 'rose');

    const { result } = renderHook(() => {
      return useAccent();
    });

    expect(result.current.accent).toBe('rose');
  });

  test('falls back to teal for an unknown stored value', () => {
    localStorage.setItem('acm-accent', 'chartreuse');

    const { result } = renderHook(() => {
      return useAccent();
    });

    expect(result.current.accent).toBe('teal');
  });

  test('persists a change and marks the document', () => {
    const { result } = renderHook(() => {
      return useAccent();
    });

    act(() => {
      result.current.setAccent('sky');
    });

    expect(result.current.accent).toBe('sky');
    expect(localStorage.getItem('acm-accent')).toBe('sky');
    expect(document.documentElement.dataset.accent).toBe('sky');
  });

  test('offers every accent the stylesheet defines', () => {
    expect(accentNames).toEqual(['teal', 'iris', 'amber', 'rose', 'lime', 'sky']);
  });
});
