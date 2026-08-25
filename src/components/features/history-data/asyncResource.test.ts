import {
  describe,
  expect,
  test,
} from 'vitest';

import { runLoad } from './asyncResource';

import type { SetStateAction } from 'react';
import type { AsyncSnapshot } from './asyncResource';

interface StateSpy {
  (action: SetStateAction<AsyncSnapshot<number>>): void;
  readonly calls: readonly (readonly [SetStateAction<AsyncSnapshot<number>>])[];
}

const makeStateSpy = (): StateSpy => {
  const calls: [SetStateAction<AsyncSnapshot<number>>][] = [];

  const spy = (action: SetStateAction<AsyncSnapshot<number>>): void => {
    calls.push([action]);
  };

  return Object.assign(spy, { calls });
};

describe('runLoad', () => {
  test('stores resolved data', async () => {
    const setState = makeStateSpy();

    await runLoad((): Promise<number> => {
      return Promise.resolve(5);
    }, setState);

    expect(setState.calls.at(0)).toEqual([{
      status: 'ready',
      data: 5,
    }]);
  });

  test('stores the message of a rejection', async () => {
    const setState = makeStateSpy();

    const loader = (): Promise<number> => {
      return Promise.reject(new Error('bad'));
    };

    await runLoad(loader, setState);

    expect(setState.calls.at(0)).toEqual([{
      status: 'error',
      error: 'bad',
    }]);
  });
});
