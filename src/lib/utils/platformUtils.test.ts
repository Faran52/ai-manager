import {
  afterEach,
  describe,
  expect,
  test,
} from 'vitest';

import { browserPlatform, isApplePlatform } from './platformUtils';

const original = navigator.platform;

const pretend = (value: string): void => {
  Object.defineProperty(navigator, 'platform', {
    value,
    configurable: true,
  });
};

afterEach(() => {
  pretend(original);
});

describe('browserPlatform', () => {
  test('names the three desktops, and treats anything else as linux', () => {
    pretend('MacIntel');
    expect(browserPlatform()).toBe('mac');
    expect(isApplePlatform()).toBe(true);

    pretend('Win32');
    expect(browserPlatform()).toBe('windows');
    expect(isApplePlatform()).toBe(false);

    pretend('Linux x86_64');
    expect(browserPlatform()).toBe('linux');

    pretend('');
    expect(browserPlatform()).toBe('linux');
  });
});
