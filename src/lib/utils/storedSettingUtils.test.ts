import {
  afterEach,
  expect,
  test,
  vi,
} from 'vitest';

import { storedSetting } from './storedSettingUtils';

const KEY = 'acm-test-setting';

const read = (): string => {
  return localStorage.getItem(KEY) ?? 'default';
};

// What another window changing this key looks like from in here.
const elsewhere = (key: string, newValue: string | null): void => {
  window.dispatchEvent(new StorageEvent('storage', {
    key,
    newValue,
  }));
};

afterEach(() => {
  localStorage.clear();
});

test('reports what is stored, and what it is told to store', () => {
  const store = storedSetting(KEY, read);

  expect(store.read()).toBe('default');

  store.write('chosen');

  expect(store.read()).toBe('chosen');
  expect(localStorage.getItem(KEY)).toBe('chosen');
});

test('tells its readers about a change made here, which the browser will not', () => {
  const store = storedSetting(KEY, read);
  const notify = vi.fn();
  const stop = store.subscribe(notify);

  store.write('chosen');

  expect(notify).toHaveBeenCalledTimes(1);

  stop();
  store.write('again');

  expect(notify).toHaveBeenCalledTimes(1);
});

test('follows the same key changed in another window', () => {
  const applied: string[] = [];
  const store = storedSetting(KEY, read, (value) => {
    applied.push(value);
  });
  const notify = vi.fn();
  const stop = store.subscribe(notify);

  localStorage.setItem(KEY, 'from the other window');
  elsewhere(KEY, 'from the other window');

  expect(notify).toHaveBeenCalledTimes(1);
  expect(applied).toEqual(['from the other window']);

  stop();
});

test('ignores a key that is not its own', () => {
  const store = storedSetting(KEY, read);
  const notify = vi.fn();
  const stop = store.subscribe(notify);

  elsewhere('some-other-key', 'irrelevant');

  expect(notify).not.toHaveBeenCalled();

  stop();
});

test('stops listening once nothing is reading it', () => {
  const store = storedSetting(KEY, read);
  const notify = vi.fn();

  store.subscribe(notify)();
  elsewhere(KEY, 'later');

  expect(notify).not.toHaveBeenCalled();
});
