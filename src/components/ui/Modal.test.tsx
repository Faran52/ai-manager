import {
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { Modal } from './Modal';

import type { FC } from 'react';

const mount = (onClose: () => void): ReturnType<typeof render> => {
  return render(
    <Modal open onClose={onClose} labelledBy="dlg">
      <p id="dlg">content</p>
    </Modal>,
  );
};

describe('Modal', () => {
  test('renders nothing while closed', () => {
    const { container } = render(
      <Modal
        open={false}
        onClose={() => {
          return undefined;
        }}
        labelledBy="d"
      >
        x
      </Modal>,
    );

    expect(container.hasChildNodes()).toBe(false);
  });

  test('closes via the backdrop button and via Escape', async () => {
    const onClose = vi.fn();
    mount(onClose);

    await userEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  test('keeps content interactive inside the panel', async () => {
    const onClose = vi.fn();
    mount(onClose);
    await userEvent.click(screen.getByText('content'));

    expect(onClose).not.toHaveBeenCalled();
  });
});

test('keeps focus where the user put it when the parent rerenders', () => {
  const Host: FC<{ readonly tick: number }> = ({ tick }) => {
    return (
      <Modal
        open
        labelledBy="t"
        onClose={() => {
          expect(tick).toBeDefined();
        }}
      >
        <input aria-label="typed here" />
      </Modal>
    );
  };

  const { rerender } = render(<Host tick={0} />);
  const field = screen.getByLabelText('typed here');

  field.focus();
  expect(document.activeElement).toBe(field);

  rerender(<Host tick={1} />);
  rerender(<Host tick={2} />);

  expect(document.activeElement).toBe(field);
});

test('keeps the dialog mounted while its exit animation plays', async () => {
  const noop = (): void => {
    return undefined;
  };
  const { rerender } = render(
    <Modal open onClose={noop} labelledBy="dlg">
      <p id="dlg">content</p>
    </Modal>,
  );

  expect(screen.getByRole('dialog')).toBeDefined();

  rerender(
    <Modal open={false} onClose={noop} labelledBy="dlg">
      <p id="dlg">content</p>
    </Modal>,
  );

  expect(screen.getByRole('dialog')).toBeDefined();

  await waitFor(() => {
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
