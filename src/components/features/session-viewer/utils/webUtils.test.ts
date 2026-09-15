import {
  describe,
  expect,
  test,
} from 'vitest';

import { resultUrls, webUrl } from './webUtils';

describe('resultUrls', () => {
  test('lists distinct links without their trailing punctuation, six at most', () => {
    const text = [
      'See https://a.example/docs), and https://a.example/docs. again,',
      'plus https://b.example/x; https://c.example/, https://d.example/,',
      'https://e.example/, https://f.example/, https://g.example/',
    ].join(' ');

    expect(resultUrls(text).map((url) => {
      return url.host;
    })).toEqual(['a.example', 'b.example', 'c.example', 'd.example', 'e.example', 'f.example']);
  });

  test('drops a match that is not a url', () => {
    expect(resultUrls('https://[bad and https://ok.example/')).toHaveLength(1);
  });
});

describe('webUrl', () => {
  test('accepts http and https and nothing else', () => {
    expect(webUrl('https://ok.example/path')?.host).toBe('ok.example');
    expect(webUrl('ftp://files.example')).toBeUndefined();
    expect(webUrl('not a url')).toBeUndefined();
  });
});
