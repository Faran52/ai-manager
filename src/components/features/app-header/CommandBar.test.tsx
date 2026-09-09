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

import { CommandBar } from './CommandBar';

import type { CommandBarProps } from './CommandBar';

const mount = (overrides: Partial<CommandBarProps> = {}): CommandBarProps => {
  const props: CommandBarProps = {
    view: 'sessions',
    projectName: 'alpha',
    scope: 'project',
    onScopeChange: vi.fn(),
    onArchiveSession: null,
    onNotice: vi.fn(),
    ...overrides,
  };

  render(<CommandBar {...props} />);

  return props;
};

describe('CommandBar', () => {
  test('names the project the columns are scoped to', () => {
    mount({ projectName: 'alpha' });

    expect(screen.getByText('alpha')).toBeDefined();
  });

  test('falls back to all projects when nothing is selected', () => {
    mount({ projectName: null });

    expect(screen.getByText('All projects')).toBeDefined();
  });

  test('reads Global on the chip when analytics is scoped to the whole machine', () => {
    mount({
      view: 'analytics',
      projectName: null,
      scope: 'global',
    });

    expect(screen.getByText('Global')).toBeDefined();
  });

  test('switches analytics between the project and the whole machine', async () => {
    const { onScopeChange } = mount({
      view: 'analytics',
      projectName: 'alpha',
      scope: 'project',
    });

    await userEvent.click(screen.getByRole('radio', { name: 'Global' }));

    expect(onScopeChange).toHaveBeenCalledWith('global');
  });

  test('offers no archive action when there is no open session', () => {
    mount({ onArchiveSession: null });

    expect(screen.queryByRole('button', { name: /Archive/u })).toBeNull();
  });

  test('reads the promoted action, then archive, then the overflow', () => {
    mount({
      onArchiveSession: vi.fn(() => {
        return Promise.resolve();
      }),
      actions: <button type="button">Copy</button>,
      overflow: <button type="button">More</button>,
    });

    expect(screen.getAllByRole('button').map((node) => {
      return node.textContent;
    })).toEqual(['Copy', 'Archive', 'More']);
  });

  test('archives the open transcript and locks the button while it runs', async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const onArchiveSession = vi.fn(() => {
      return pending;
    });
    mount({ onArchiveSession });

    const button = screen.getByRole<HTMLButtonElement>('button', { name: /Archive/u });

    await userEvent.click(button);
    expect(onArchiveSession).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(true);

    release();
    await waitFor(() => {
      expect(button.disabled).toBe(false);
    });
  });

  test('reports the reason when the archive fails', async () => {
    const onNotice = vi.fn();
    mount({
      onNotice,
      onArchiveSession: vi.fn(() => {
        return Promise.reject(new Error('disk full'));
      }),
    });

    await userEvent.click(screen.getByRole('button', { name: /Archive/u }));

    await waitFor(() => {
      expect(onNotice).toHaveBeenCalledWith('disk full');
    });
  });
});
