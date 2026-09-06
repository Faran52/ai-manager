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

const user = userEvent.setup({ pointerEventsCheck: 0 });

const mount = (onClose: () => void): ReturnType<typeof render> => {
  return render(
    <Modal open onClose={onClose} title="Details">
      <p>content</p>
    </Modal>,
  );
};

describe('Modal', () => {
  test('renders nothing while closed', () => {
    render(
      <Modal
        open={false}
        onClose={() => {
          return undefined;
        }}
        title="Details"
      >
        x
      </Modal>,
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('takes its accessible name from the title', () => {
    mount(vi.fn());

    expect(screen.getByRole('dialog', { name: 'Details' })).toBeDefined();
  });

  test('closes on Escape', async () => {
    const onClose = vi.fn();
    mount(onClose);
    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('keeps content interactive inside the panel', async () => {
    const onClose = vi.fn();
    mount(onClose);
    await user.click(screen.getByText('content'));

    expect(onClose).not.toHaveBeenCalled();
  });

  test('moves focus into the dialog when it opens', () => {
    render(
      <Modal open onClose={vi.fn()} title="Details">
        <button type="button">first</button>
      </Modal>,
    );

    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });

  test('lays a sheet out taller than a dialog', () => {
    render(
      <Modal open onClose={vi.fn()} title="Settings" variant="sheet">
        <p>panes</p>
      </Modal>,
    );

    expect(screen.getByRole('dialog').className).toContain('flex-col');
  });

  test('keeps focus where the user put it when the parent rerenders', () => {
    const Host: FC<{ readonly tick: number }> = ({ tick }) => {
      return (
        <Modal
          open
          title="Details"
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
      <Modal open onClose={noop} title="Details">
        <p>content</p>
      </Modal>,
    );

    expect(screen.getByRole('dialog')).toBeDefined();

    rerender(
      <Modal open={false} onClose={noop} title="Details">
        <p>content</p>
      </Modal>,
    );

    expect(screen.getByRole('dialog')).toBeDefined();

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});
