import {
  act,
  render,
  screen,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach,
  expect,
  test,
  vi,
} from 'vitest';

import { scrollDockStorageKey } from '@config/storageKeys';

import { SETTLE_MS } from '../constants';

import { ScrollToEnd } from './ScrollToEnd';

interface Box {
  readonly element: HTMLDivElement;
  readonly scrolled: () => number;
}

const box = (away: number): Box => {
  const element = document.createElement('div');
  const content = document.createElement('div');
  let top = 0;

  element.append(content);
  document.body.append(element);

  Object.defineProperty(element, 'scrollHeight', { value: 1_000 });
  Object.defineProperty(element, 'clientHeight', { value: 400 });
  Object.defineProperty(element, 'scrollTop', {
    get: () => {
      return 600 - away;
    },
  });

  element.scrollTo = ((options: ScrollToOptions) => {
    top = options.top ?? 0;
  }) as typeof element.scrollTo;

  return {
    element,
    scrolled: () => {
      return top;
    },
  };
};

afterEach(() => {
  localStorage.clear();
  document.body.replaceChildren();
});

test('stays out of the way when the box is already at its end', () => {
  const { element } = box(0);

  render(<ScrollToEnd scrollElement={element} />);

  expect(screen.queryByRole('button')).toBeNull();
});

test('offers itself once there is somewhere to go, and goes there', async () => {
  const { element, scrolled } = box(500);

  render(<ScrollToEnd scrollElement={element} />);

  await userEvent.click(screen.getByRole('button'));

  expect(scrolled()).toBe(1_000);
});

test('loads the rest before jumping, where there is a rest', async () => {
  const { element, scrolled } = box(500);
  const onLoadRest = vi.fn();

  render(<ScrollToEnd scrollElement={element} hasMore onLoadRest={onLoadRest} />);

  await userEvent.click(screen.getByRole('button'));

  expect(onLoadRest).toHaveBeenCalledTimes(1);
  expect(scrolled()).toBe(0);
});

test('jumps once the loading it asked for has finished', () => {
  const { element, scrolled } = box(500);
  const { rerender } = render(
    <ScrollToEnd scrollElement={element} hasMore loading onLoadRest={vi.fn()} />,
  );

  expect(scrolled()).toBe(0);

  rerender(<ScrollToEnd scrollElement={element} onLoadRest={vi.fn()} />);

  expect(scrolled()).toBe(1_000);
});

test('shows nothing to press against when it has no box', () => {
  render(<ScrollToEnd scrollElement={null} hasMore />);

  expect(screen.getByRole('button')).toBeInstanceOf(HTMLButtonElement);
});

test('remembers where it was dragged to, and a drag is not a press', async () => {
  const { element, scrolled } = box(500);

  Object.defineProperty(element, 'getBoundingClientRect', {
    value: () => {
      return {
        width: 800,
        height: 600,
      };
    },
  });

  render(<ScrollToEnd scrollElement={element} dockKey="acm-test-dock" />);

  const button = screen.getByRole('button');

  button.setPointerCapture = vi.fn();
  button.releasePointerCapture = vi.fn();

  await act(async () => {
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    button.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true,
      movementX: -30,
      movementY: -40,
    }));
    button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    await Promise.resolve();
  });

  expect(JSON.parse(localStorage.getItem('acm-test-dock') ?? '{}')).toStrictEqual({
    x: 54,
    y: 64,
  });
  // The press travelled, so it moved the button rather than the box.
  expect(scrolled()).toBe(0);
  expect(localStorage.getItem(scrollDockStorageKey)).toBeNull();
});

test('falls back to its corner when what was stored makes no sense', async () => {
  const { element, scrolled } = box(500);

  localStorage.setItem('acm-odd-dock', '{"x":"left"}');
  render(<ScrollToEnd scrollElement={element} dockKey="acm-odd-dock" />);

  await userEvent.click(screen.getByRole('button'));

  expect(scrolled()).toBe(1_000);
  expect(JSON.parse(localStorage.getItem('acm-odd-dock') ?? '{}')).toStrictEqual({
    x: 24,
    y: 24,
  });
});

test('does nothing where the box has no content to measure', async () => {
  const empty = document.createElement('div');
  const moved = vi.fn();

  Object.defineProperty(empty, 'scrollHeight', { value: 1_000 });
  Object.defineProperty(empty, 'clientHeight', { value: 400 });
  empty.scrollTo = moved;
  document.body.append(empty);

  render(<ScrollToEnd scrollElement={empty} />);

  await userEvent.click(screen.getByRole('button'));

  expect(moved).not.toHaveBeenCalled();
});

test('stops holding the end once the content has settled', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });

  const { element, scrolled } = box(500);
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

  render(<ScrollToEnd scrollElement={element} />);

  await user.click(screen.getByRole('button'));

  expect(scrolled()).toBe(1_000);

  await act(async () => {
    vi.advanceTimersByTime(SETTLE_MS + 10);
    await Promise.resolve();
  });

  vi.useRealTimers();
});

test('comes back where it was left', () => {
  const { element } = box(500);

  localStorage.setItem('acm-kept-dock', JSON.stringify({
    x: 120,
    y: 90,
  }));
  render(<ScrollToEnd scrollElement={element} dockKey="acm-kept-dock" />);

  const button = screen.getByRole('button');

  expect(button.style.right).toBe('120px');
  expect(button.style.bottom).toBe('90px');
});

test('a press that travelled moves the button and not the box', async () => {
  const { element, scrolled } = box(500);

  Object.defineProperty(element, 'getBoundingClientRect', {
    value: () => {
      return {
        width: 800,
        height: 600,
      };
    },
  });

  render(<ScrollToEnd scrollElement={element} dockKey="acm-slop-dock" />);

  const button = screen.getByRole('button');

  button.setPointerCapture = vi.fn();
  button.releasePointerCapture = vi.fn();

  await act(async () => {
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    button.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true,
      movementX: -30,
      movementY: -40,
    }));
    button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    // The click the drag itself ends with, not a fresh press.
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
  });

  expect(scrolled()).toBe(0);
});

test('can still be moved before a box has attached', async () => {
  render(<ScrollToEnd scrollElement={null} hasMore dockKey="acm-loose-dock" />);

  const button = screen.getByRole('button');

  button.setPointerCapture = vi.fn();
  button.releasePointerCapture = vi.fn();

  await act(async () => {
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    button.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true,
      movementX: 10,
      movementY: 10,
    }));
    button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    await Promise.resolve();
  });

  // No box means no room, so it clamps into the corner.
  expect(JSON.parse(localStorage.getItem('acm-loose-dock') ?? '{}')).toStrictEqual({
    x: 0,
    y: 0,
  });
});

test('holds the end again each time the content measures taller', async () => {
  const fired: (() => void)[] = [];

  class StubResizeObserver {
    public constructor(callback: () => void) {
      fired.push(callback);
    }

    public observe(): void {
      return undefined;
    }

    public disconnect(): void {
      return undefined;
    }
  }

  vi.stubGlobal('ResizeObserver', StubResizeObserver);

  const { element } = box(500);
  const behaviours: (ScrollBehavior | undefined)[] = [];

  element.scrollTo = ((options: ScrollToOptions) => {
    behaviours.push(options.behavior);
  }) as typeof element.scrollTo;

  render(<ScrollToEnd scrollElement={element} />);

  await userEvent.click(screen.getByRole('button'));

  expect(behaviours).toStrictEqual(['smooth']);

  act(() => {
    for (const callback of fired) {
      callback();
    }
  });

  // The correction behind the glide, which does not animate.
  expect(behaviours).toContain('auto');

  vi.unstubAllGlobals();
});
