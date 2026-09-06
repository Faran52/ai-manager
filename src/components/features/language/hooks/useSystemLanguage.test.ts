import { act, renderHook } from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  test,
} from 'vitest';

import { languageStorageKey } from '@config/storageKeys';

import { useSystemLanguage } from './useSystemLanguage';

afterEach(() => {
  globalThis.localStorage.removeItem(languageStorageKey);
});

describe('useSystemLanguage', () => {
  test('follows the system while nothing has been chosen', () => {
    const { result } = renderHook(() => {
      return useSystemLanguage();
    });

    expect(result.current.following).toBe(true);
  });

  test('stops following once a language is stored', () => {
    globalThis.localStorage.setItem(languageStorageKey, 'ja');

    const { result } = renderHook(() => {
      return useSystemLanguage();
    });

    expect(result.current.following).toBe(false);
  });

  test('remembers a chosen language and stops following', () => {
    const { result } = renderHook(() => {
      return useSystemLanguage();
    });

    act(() => {
      result.current.choose('ko');
    });

    expect(globalThis.localStorage.getItem(languageStorageKey)).toBe('ko');
    expect(result.current.following).toBe(false);
  });

  test('forgets the choice so the system decides again', () => {
    globalThis.localStorage.setItem(languageStorageKey, 'ar');

    const { result } = renderHook(() => {
      return useSystemLanguage();
    });

    act(() => {
      result.current.follow();
    });

    expect(globalThis.localStorage.getItem(languageStorageKey)).toBeNull();
    expect(result.current.following).toBe(true);
  });
});
