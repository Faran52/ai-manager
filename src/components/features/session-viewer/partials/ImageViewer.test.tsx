import {
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ImageViewer } from './ImageViewer';

const noop = (): void => {
  return undefined;
};

const surface = (): HTMLElement => {
  return screen.getByRole('presentation');
};

test('closes from the backdrop, the toolbar and Escape', async () => {
  const onClose = vi.fn();

  render(<ImageViewer src="https://example.com/a.png" onClose={onClose} />);

  await userEvent.click(screen.getAllByLabelText('Close image viewer')[0] ?? document.body);
  await userEvent.click(screen.getAllByLabelText('Close image viewer')[1] ?? document.body);
  fireEvent.keyDown(window, { key: 'Escape' });

  expect(onClose).toHaveBeenCalledTimes(3);
});

test('zooms with the toolbar, the keyboard and the wheel, and resets', async () => {
  render(<ImageViewer src="https://example.com/a.png" onClose={noop} />);

  expect(screen.getByLabelText('Zoom out').getAttribute('disabled')).toBe('');

  await userEvent.click(screen.getByLabelText('Zoom in'));
  expect(screen.getByText('150%')).toBeDefined();

  await userEvent.click(screen.getByLabelText('Zoom out'));
  await userEvent.click(screen.getByLabelText('Zoom in'));

  fireEvent.keyDown(window, { key: '+' });
  fireEvent.keyDown(window, { key: '=' });
  expect(screen.getByText('250%')).toBeDefined();

  fireEvent.wheel(surface(), { deltaY: -1 });
  expect(screen.getByText('300%')).toBeDefined();

  fireEvent.wheel(surface(), { deltaY: 1 });
  expect(screen.getByText('250%')).toBeDefined();

  fireEvent.keyDown(window, { key: '0' });
  expect(screen.getByText('100%')).toBeDefined();

  fireEvent.keyDown(window, { key: 'a' });
  expect(screen.getByText('100%')).toBeDefined();
});

test('stops at the zoom ceiling and back at the floor', () => {
  render(<ImageViewer src="https://example.com/a.png" onClose={noop} />);

  for (let step = 0; step < 9; step += 1) {
    fireEvent.keyDown(window, { key: '+' });
  }
  expect(screen.getByText('500%')).toBeDefined();
  expect(screen.getByLabelText('Zoom in').getAttribute('disabled')).toBe('');

  for (let step = 0; step < 9; step += 1) {
    fireEvent.keyDown(window, { key: '-' });
  }
  expect(screen.getByText('100%')).toBeDefined();
});

test('toggles zoom by double click', () => {
  render(<ImageViewer src="https://example.com/a.png" onClose={noop} />);

  fireEvent.doubleClick(surface());
  expect(screen.getByText('200%')).toBeDefined();

  fireEvent.doubleClick(surface());
  expect(screen.getByText('100%')).toBeDefined();
});

test('pans only once zoomed in', () => {
  render(<ImageViewer src="https://example.com/a.png" onClose={noop} />);

  const image = screen.getByRole('img');
  const pan = surface();

  pan.setPointerCapture = noop;

  fireEvent.pointerDown(pan, {
    pointerId: 1,
    clientX: 10,
    clientY: 10,
  });
  fireEvent.pointerMove(pan, {
    clientX: 40,
    clientY: 30,
  });
  expect(image.style.transform).toContain('translate(0px, 0px)');

  fireEvent.keyDown(window, { key: '+' });
  fireEvent.pointerDown(pan, {
    pointerId: 1,
    clientX: 10,
    clientY: 10,
  });
  fireEvent.pointerMove(pan, {
    clientX: 40,
    clientY: 30,
  });
  expect(image.style.transform).toContain('translate(30px, 20px)');

  fireEvent.pointerUp(pan);
  fireEvent.pointerMove(pan, {
    clientX: 90,
    clientY: 90,
  });
  expect(image.style.transform).toContain('translate(30px, 20px)');

  fireEvent.keyDown(window, { key: '0' });
  expect(image.style.transform).toContain('translate(0px, 0px)');
});

test('restores the page scroll it locked', () => {
  const { unmount } = render(<ImageViewer src="https://example.com/a.png" onClose={noop} />);

  expect(document.body.style.overflow).toBe('hidden');
  unmount();
  expect(document.body.style.overflow).toBe('');
});
