import {
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import {
  fixtureContext,
  fixtureRow,
  fixtureSession,
} from '@mocks/sessionRowFixtures';

import { SessionListRow } from './SessionListRow';

describe('SessionListRow', () => {
  test('opens the session on a click and the menu on a right click', async () => {
    const onSelect = vi.fn();
    const onOpenMenu = vi.fn();
    const row = fixtureRow('a');

    render(
      <ul>
        <SessionListRow
          row={row}
          continuation={false}
          context={fixtureContext({
            onSelect,
            onOpenMenu,
            selectedFilePath: row.session.filePath,
          })}
        />
      </ul>,
    );

    const button = screen.getByRole('button', { name: /Session a/ });

    expect(button.getAttribute('aria-current')).toBe('true');
    await userEvent.click(button);
    fireEvent.contextMenu(button);

    expect(onSelect).toHaveBeenCalledWith(row.session);
    expect(onOpenMenu).toHaveBeenCalledTimes(1);
  });

  test('in selection mode a click ticks the row and the menu stays shut', async () => {
    const onToggleSelection = vi.fn();
    const onOpenMenu = vi.fn();
    const row = fixtureRow('a');

    render(
      <ul>
        <SessionListRow
          row={row}
          continuation
          context={fixtureContext({
            selecting: true,
            selectedPaths: [row.session.filePath],
            onToggleSelection,
            onOpenMenu,
          })}
        />
      </ul>,
    );

    const button = screen.getByRole('button', { name: /Session a/ });

    expect(button.getAttribute('aria-pressed')).toBe('true');
    await userEvent.click(button);
    fireEvent.contextMenu(button);

    expect(onToggleSelection).toHaveBeenCalledWith(row.session);
    expect(onOpenMenu).not.toHaveBeenCalled();
  });

  test('carries a thread toggle, a preview line and a project badge when it has them', async () => {
    const onToggleThread = vi.fn();
    const row = fixtureRow('a', {
      partCount: 3,
      session: fixtureSession('a', { preview: 'first words' }),
    });

    render(
      <ul>
        <SessionListRow
          row={row}
          continuation={false}
          context={fixtureContext({
            onToggleThread,
            projectNames: new Map([['claude:p', 'webapp']]),
          })}
        />
      </ul>,
    );

    await userEvent.click(screen.getByRole('button', { name: '3 parts' }));

    expect(onToggleThread).toHaveBeenCalledWith('thread-a');
    expect(screen.getByText('first words')).toBeDefined();
    expect(screen.getByText('webapp')).toBeDefined();
  });
});
