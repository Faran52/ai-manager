// Global test setup, wired from `vitest.config.ts`. Every global mock belongs here.

import { initI18n } from '@i18n/index';

// Components call useTranslation directly, so the runtime has to exist before
// any of them render or they would only ever show raw keys.
initI18n();

/**
 * happy-dom performs no layout, so every element measures zero.
 *
 * A virtualized list asks the DOM how tall its viewport and rows are, reads
 * zeroes, and concludes nothing is on screen, which would make every timeline
 * test assert against an empty container. These give layout a plausible answer.
 */
const VIEWPORT_PX = 900;
const ROW_PX = 200;

Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
  configurable: true,
  get(this: HTMLElement) {
    return this.hasAttribute('data-index') ? ROW_PX : VIEWPORT_PX;
  },
});

Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
  configurable: true,
  get: () => {
    return VIEWPORT_PX;
  },
});

Element.prototype.getBoundingClientRect = function getBoundingClientRect(this: Element): DOMRect {
  const height = this.hasAttribute('data-index') ? ROW_PX : VIEWPORT_PX;

  return {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: VIEWPORT_PX,
    bottom: height,
    width: VIEWPORT_PX,
    height,
    toJSON: () => {
      return {};
    },
  };
};

export {};
