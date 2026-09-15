import { act, renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  expect,
  test,
  vi,
} from 'vitest';

import { useAppShortcuts } from './useAppShortcuts';

test('routes each global key to a view or a dialog, except while typing', async () => {
  const setView = vi.fn();
  const reload = vi.fn();
  const { result } = renderHook(() => {
    return useAppShortcuts(setView, reload);
  });

  await userEvent.keyboard('1');
  await userEvent.keyboard('2');
  await userEvent.keyboard('3');
  await userEvent.keyboard('4');
  await userEvent.keyboard('r');
  expect(setView).toHaveBeenNthCalledWith(1, 'sessions');
  expect(setView).toHaveBeenNthCalledWith(2, 'analytics');
  expect(setView).toHaveBeenNthCalledWith(3, 'health');
  expect(setView).toHaveBeenNthCalledWith(4, 'archive');
  expect(reload).toHaveBeenCalledTimes(1);

  await userEvent.keyboard('/');
  expect(result.current.searchOpen).toBe(true);
  await userEvent.keyboard('5');
  expect(result.current.settingsOpen).toBe(true);
  await userEvent.keyboard('{Shift>}?{/Shift}');
  expect(result.current.shortcutsOpen).toBe(true);

  act(() => {
    result.current.setSearchOpen(false);
    result.current.setSettingsOpen(false);
    result.current.setShortcutsOpen(false);
  });

  const input = document.createElement('input');

  document.body.append(input);
  input.focus();
  await userEvent.keyboard('/');
  expect(result.current.searchOpen).toBe(false);
  input.remove();
});
