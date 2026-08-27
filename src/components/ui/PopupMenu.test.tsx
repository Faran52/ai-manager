import {
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import {
  expect,
  test,
  vi,
} from 'vitest';

import { PopupMenu } from './PopupMenu';

test('renders only while open and dismisses for external events', () => {
  const onClose = vi.fn();
  const { rerender, unmount } = render(
    <PopupMenu open={false} onClose={onClose} label="Actions">
      <button type="button">Action</button>
    </PopupMenu>,
  );

  expect(screen.queryByRole('menu')).toBeNull();

  rerender(
    <PopupMenu open onClose={onClose} label="Actions">
      <button type="button">Action</button>
    </PopupMenu>,
  );

  fireEvent.pointerDown(screen.getByRole('menu'));
  fireEvent.pointerDown(window);
  fireEvent.scroll(screen.getByRole('menu'));
  expect(onClose).not.toHaveBeenCalled();

  fireEvent.pointerDown(document.body);
  fireEvent.keyDown(window, { key: 'Enter' });
  fireEvent.keyDown(window, { key: 'Escape' });
  fireEvent.blur(window);
  fireEvent.resize(window);
  fireEvent.scroll(document);

  expect(onClose).toHaveBeenCalledTimes(5);
  unmount();
});

test('positions a context menu inside the viewport', () => {
  render(
    <PopupMenu
      open
      onClose={() => {
        return undefined;
      }}
      label="Context actions"
      position={{
        x: 900,
        y: 700,
      }}
    >
      <button type="button">Action</button>
    </PopupMenu>,
  );

  expect(screen.getByRole('menu').getAttribute('class')).toContain('fixed');
});

test('left-aligns an anchored menu when requested', () => {
  render(
    <PopupMenu
      open
      align="left"
      onClose={() => {
        return undefined;
      }}
      label="Filters"
    >
      <button type="button">Action</button>
    </PopupMenu>,
  );

  expect(screen.getByRole('menu').className).toContain('inset-s-0');
});
