import {
  afterEach,
  describe,
  expect,
  test,
} from 'vitest';

import {
  applyDocumentDirection,
  initI18n,
  resources,
} from './index';

afterEach(() => {
  applyDocumentDirection('en');
});

describe('applyDocumentDirection', () => {
  test('turns the document around for Arabic', () => {
    applyDocumentDirection('ar');

    expect(document.documentElement.dir).toBe('rtl');
  });

  test('leaves every other language reading left to right', () => {
    applyDocumentDirection('ja');

    expect(document.documentElement.dir).toBe('ltr');
  });

  test('names the language on the document as well as its direction', () => {
    applyDocumentDirection('ja');

    expect(document.documentElement.lang).toBe('ja');
  });
});

describe('resources', () => {
  test('ships every locale the app offers', () => {
    expect(Object.keys(resources).sort((left, right) => {
      return left.localeCompare(right);
    })).toEqual([
      'ar',
      'en',
      'ja',
      'ko',
      'zh-CN',
      'zh-TW',
    ]);
  });
});

describe('initI18n', () => {
  test('returns the same runtime on a second call', () => {
    expect(initI18n()).toBe(initI18n());
  });
});
