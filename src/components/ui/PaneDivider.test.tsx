import {
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  expect,
  test,
  vi,
} from 'vitest';

import { PaneDivider } from './PaneDivider';

const mount = (): ReturnType<typeof vi.fn> => {
  const onResize = vi.fn();

  render(<PaneDivider label="Resize panes" value={200} min={100} max={600} onResize={onResize} />);

  return onResize;
};

const dragging = (element: HTMLElement, held: boolean): void => {
  element.setPointerCapture = (): void => {
    return undefined;
  };
  element.hasPointerCapture = (): boolean => {
    return held;
  };
};

test('announces the size it currently sets', () => {
  mount();

  const divider = screen.getByRole('slider');

  expect(divider.getAttribute('aria-valuenow')).toBe('200');
  expect(divider.getAttribute('aria-valuemin')).toBe('100');
  expect(divider.getAttribute('aria-valuemax')).toBe('600');
});

test('resizes by dragging', () => {
  const onResize = mount();
  const divider = screen.getByRole('slider');

  dragging(divider, true);
  fireEvent.pointerDown(divider, {
    pointerId: 1,
    clientY: 100,
  });
  fireEvent.pointerMove(divider, {
    pointerId: 1,
    clientY: 130,
  });

  expect(onResize).toHaveBeenCalledWith(30);
});

test('splits a drag into per-move deltas', () => {
  const onResize = mount();
  const divider = screen.getByRole('slider');

  dragging(divider, true);
  fireEvent.pointerDown(divider, {
    pointerId: 1,
    clientY: 100,
  });
  fireEvent.pointerMove(divider, {
    pointerId: 1,
    clientY: 115,
  });
  fireEvent.pointerMove(divider, {
    pointerId: 1,
    clientY: 140,
  });

  expect(onResize).toHaveBeenNthCalledWith(1, 15);
  expect(onResize).toHaveBeenNthCalledWith(2, 25);
});

test('ignores movement when no drag is in progress', () => {
  const onResize = mount();
  const divider = screen.getByRole('slider');

  dragging(divider, false);
  fireEvent.pointerMove(divider, {
    pointerId: 1,
    movementY: 30,
  });

  expect(onResize).not.toHaveBeenCalled();
});

test('resizes with the arrow keys, so a pointer is not required', async () => {
  const onResize = mount();

  screen.getByRole('slider').focus();
  await userEvent.keyboard('{ArrowDown}{ArrowUp}');

  expect(onResize).toHaveBeenNthCalledWith(1, 24);
  expect(onResize).toHaveBeenNthCalledWith(2, -24);
});

test('leaves other keys to the page', async () => {
  const onResize = mount();

  screen.getByRole('slider').focus();
  await userEvent.keyboard('{Enter}');

  expect(onResize).not.toHaveBeenCalled();
});
