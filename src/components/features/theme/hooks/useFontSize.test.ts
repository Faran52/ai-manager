import { act, renderHook } from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  test,
} from 'vitest';

import { fontSizes, useFontSize } from './useFontSize';

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-font-size');
});

describe('useFontSize', () => {
  test('defaults to normal when nothing is stored', () => {
    const { result } = renderHook(() => {
      return useFontSize();
    });

    expect(result.current.fontSize).toBe('normal');
  });

  test('reads a stored size', () => {
    localStorage.setItem('acm-font-size', 'large');

    const { result } = renderHook(() => {
      return useFontSize();
    });

    expect(result.current.fontSize).toBe('large');
  });

  test('falls back to normal for an unknown stored value', () => {
    localStorage.setItem('acm-font-size', 'enormous');

    const { result } = renderHook(() => {
      return useFontSize();
    });

    expect(result.current.fontSize).toBe('normal');
  });

  test('persists a change and marks the document', () => {
    const { result } = renderHook(() => {
      return useFontSize();
    });

    act(() => {
      result.current.setFontSize('compact');
    });

    expect(result.current.fontSize).toBe('compact');
    expect(localStorage.getItem('acm-font-size')).toBe('compact');
    expect(document.documentElement.dataset.fontSize).toBe('compact');
  });

  test('offers every size the stylesheet defines', () => {
    expect(fontSizes).toEqual(['compact', 'normal', 'large']);
  });
});
