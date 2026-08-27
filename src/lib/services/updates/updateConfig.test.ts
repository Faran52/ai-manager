import {
  describe,
  expect,
  test,
} from 'vitest';

import { updateConfigFromEnv } from './updateConfig';

describe('updateConfigFromEnv', () => {
  test('builds a config from the feed url and optional key', () => {
    expect(updateConfigFromEnv({
      UPDATE_FEED_URL: 'https://releases.example.com/app',
      UPDATE_PUBLIC_KEY: 'key',
    })).toMatchObject({
      baseUrl: 'https://releases.example.com/app',
      publicKey: 'key',
    });
  });

  test('returns nothing when the feed url is missing or blank', () => {
    expect(updateConfigFromEnv({})).toBeUndefined();
    expect(updateConfigFromEnv({ UPDATE_FEED_URL: '' })).toBeUndefined();
  });

  test('falls back to the ambient environment', () => {
    expect(updateConfigFromEnv()).toBeUndefined();
  });
});
