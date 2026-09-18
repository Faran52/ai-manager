import { vi } from 'vitest';

/*
 * happy-dom answers every media query false, so the reduced-motion branch is
 * unreachable without taking control of matchMedia. Three specs each kept their
 * own copy of this, which is one stub per place the shim has to be replaced.
 */
export const reducedMotion = (matches: boolean): void => {
  vi.stubGlobal('matchMedia', () => {
    return {
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
  });
};
