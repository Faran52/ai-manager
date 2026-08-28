import { renderHook } from '@testing-library/react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { useSmoothScroll } from './useSmoothScroll';

let frames: FrameRequestCallback[] = [];
let cancelled: number[] = [];

const scrollable = (scrollHeight = 2_000, clientHeight = 500): HTMLDivElement => {
  const element = document.createElement('div');

  Object.defineProperty(element, 'scrollHeight', { value: scrollHeight });
  Object.defineProperty(element, 'clientHeight', { value: clientHeight });
  element.scrollTop = 0;

  return element;
};

// happy-dom drops the modifier flags a WheelEventInit carries, so they are set
// on the event itself rather than asserted through a constructor that ignores them.
const wheel = (element: HTMLElement, init: WheelEventInit & { readonly modifier?: 'ctrl' | 'meta' }): void => {
  const {
    modifier,
    ...rest
  } = init;
  const event = new WheelEvent('wheel', {
    cancelable: true,
    ...rest,
  });

  if (modifier != null) {
    Object.defineProperty(event, modifier === 'ctrl' ? 'ctrlKey' : 'metaKey', { value: true });
  }

  element.dispatchEvent(event);
};

// Each frame is one 60Hz tick, so the easing advances exactly as it would live.
const runFrames = (count: number): void => {
  for (let tick = 1; tick <= count; tick += 1) {
    const pending = frames.shift();

    if (pending == null) {
      return;
    }

    pending(tick * (1000 / 60));
  }
};

beforeEach(() => {
  frames = [];
  cancelled = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback);

    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', (handle: number) => {
    cancelled.push(handle);
  });
  vi.stubGlobal('matchMedia', vi.fn(() => {
    return {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useSmoothScroll', () => {
  test('does nothing without an element', () => {
    renderHook(() => {
      useSmoothScroll(null);
    });

    expect(frames).toHaveLength(0);
  });

  test('leaves scrolling alone for a reader who asked for reduced motion', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => {
      return { matches: true };
    }));

    const element = scrollable();

    renderHook(() => {
      useSmoothScroll(element);
    });
    wheel(element, { deltaY: 100 });

    expect(frames).toHaveLength(0);
    expect(element.scrollTop).toBe(0);
  });

  test('eases toward the wheel target rather than jumping to it', () => {
    const element = scrollable();

    renderHook(() => {
      useSmoothScroll(element);
    });
    wheel(element, { deltaY: 400 });

    runFrames(1);
    const afterOne = element.scrollTop;

    expect(afterOne).toBeGreaterThan(0);
    expect(afterOne).toBeLessThan(400);

    runFrames(200);
    expect(element.scrollTop).toBe(400);
  });

  test('lands exactly on the target once the remaining distance is negligible', () => {
    const element = scrollable();

    renderHook(() => {
      useSmoothScroll(element);
    });
    wheel(element, { deltaY: 1 });
    runFrames(200);

    expect(element.scrollTop).toBe(1);
    expect(frames).toHaveLength(0);
  });

  test('clamps at the top and at the furthest the element can scroll', () => {
    const element = scrollable(2_000, 500);

    renderHook(() => {
      useSmoothScroll(element);
    });

    wheel(element, { deltaY: 9_000 });
    runFrames(400);
    expect(element.scrollTop).toBe(1_500);

    wheel(element, { deltaY: -9_000 });
    runFrames(400);
    expect(element.scrollTop).toBe(0);
  });

  test('reads a wheel that reports lines or pages instead of pixels', () => {
    const lines = scrollable();

    renderHook(() => {
      useSmoothScroll(lines);
    });
    wheel(lines, {
      deltaY: 3,
      deltaMode: 1,
    });
    runFrames(200);
    expect(lines.scrollTop).toBe(48);

    const pages = scrollable();

    renderHook(() => {
      useSmoothScroll(pages);
    });
    wheel(pages, {
      deltaY: 1,
      deltaMode: 2,
    });
    runFrames(200);
    expect(pages.scrollTop).toBe(500);
  });

  test('leaves a zooming gesture to the browser', () => {
    const element = scrollable();

    renderHook(() => {
      useSmoothScroll(element);
    });
    wheel(element, {
      deltaY: 100,
      modifier: 'ctrl',
    });
    wheel(element, {
      deltaY: 100,
      modifier: 'meta',
    });

    expect(frames).toHaveLength(0);
  });

  test('keeps one frame in flight however fast the wheel turns', () => {
    const element = scrollable();

    renderHook(() => {
      useSmoothScroll(element);
    });
    wheel(element, { deltaY: 100 });
    wheel(element, { deltaY: 100 });
    wheel(element, { deltaY: 100 });

    expect(frames).toHaveLength(1);

    runFrames(200);
    expect(element.scrollTop).toBe(300);
  });

  test('takes an outside scroll that arrives while it is idle', () => {
    const element = scrollable();

    renderHook(() => {
      useSmoothScroll(element);
    });

    element.scrollTop = 700;
    element.dispatchEvent(new Event('scroll'));

    expect(cancelled).toHaveLength(0);

    wheel(element, { deltaY: 100 });
    runFrames(200);
    expect(element.scrollTop).toBe(800);
  });

  test('hands the position over when something else scrolls', () => {
    const element = scrollable();

    renderHook(() => {
      useSmoothScroll(element);
    });
    wheel(element, { deltaY: 400 });
    runFrames(1);

    element.scrollTop = 900;
    element.dispatchEvent(new Event('scroll'));

    expect(cancelled).toHaveLength(1);

    runFrames(200);
    expect(element.scrollTop).toBe(900);
  });

  test('ignores a scroll it caused itself', () => {
    const element = scrollable();

    renderHook(() => {
      useSmoothScroll(element);
    });
    wheel(element, { deltaY: 400 });
    runFrames(1);

    const eased = element.scrollTop;

    element.dispatchEvent(new Event('scroll'));
    expect(cancelled).toHaveLength(0);

    runFrames(200);
    expect(element.scrollTop).toBe(400);
    expect(eased).toBeLessThan(400);
  });

  test('resolves a gap from a backgrounded tab over frames, not in one jump', () => {
    const element = scrollable();

    renderHook(() => {
      useSmoothScroll(element);
    });
    wheel(element, { deltaY: 1_000 });

    frames.shift()?.(0);
    frames.shift()?.(10_000);

    expect(element.scrollTop).toBeLessThan(1_000);
  });

  test('stops listening once unmounted', () => {
    const element = scrollable();
    const { unmount } = renderHook(() => {
      useSmoothScroll(element);
    });

    unmount();
    wheel(element, { deltaY: 400 });

    expect(frames).toHaveLength(0);
  });
});
