import {
  describe,
  expect,
  test,
} from 'vitest';

import {
  directionOf,
  fallbackLanguage,
  labelOf,
  languages,
} from './config';

describe('language config', () => {
  test('marks arabic as the only right to left locale', () => {
    expect(directionOf('ar')).toBe('rtl');
    expect(directionOf('en')).toBe('ltr');
    expect(directionOf('ja')).toBe('ltr');
  });

  test('treats an unknown language as left to right', () => {
    expect(directionOf('xx')).toBe('ltr');
  });

  test('resolves a label only for an exact language tag', () => {
    expect(labelOf('en')).toBe('English');
    expect(labelOf('en-GB')).toBe('');
  });

  test('ships every locale with a label and includes the fallback', () => {
    expect(languages.map((option) => {
      return option.id;
    })).toContain(fallbackLanguage);
    expect(languages.every((option) => {
      return option.label.length > 0;
    })).toBe(true);
  });
});
