import {
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach,
  expect,
  test,
  vi,
} from 'vitest';

import { ExportMenu } from './ExportMenu';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('offers a downloaded file per format', async () => {
  render(<ExportMenu entries={[]} project="project" title="Session" />);

  await userEvent.click(screen.getByRole('button', { name: 'Export session' }));

  expect(screen.getByRole('menuitem', { name: 'Export Markdown file' })).toBeDefined();
  expect(screen.getByRole('menuitem', { name: 'Export HTML file' })).toBeDefined();
  expect(screen.getByRole('menuitem', { name: 'Export JSON file' })).toBeDefined();
  expect(screen.queryByRole('menuitem', { name: 'Copy markdown' })).toBeNull();
});

test('stays closed when the trigger is double-clicked', async () => {
  render(<ExportMenu entries={[]} project="project" title="Session" />);

  await userEvent.dblClick(screen.getByRole('button', { name: 'Export session' }));

  await waitFor(() => {
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

test.each([
  ['Export Markdown file'],
  ['Export HTML file'],
  ['Export JSON file'],
])('downloads a file for %s', async (label) => {
  const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
  const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {
    return undefined;
  });
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
    return undefined;
  });

  render(<ExportMenu entries={[]} project="project" title="Doc" />);

  await userEvent.click(screen.getByRole('button', { name: 'Export session' }));
  await userEvent.click(screen.getByRole('menuitem', { name: label }));

  expect(createObjectURL).toHaveBeenCalledOnce();
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:x');
  expect(click).toHaveBeenCalledOnce();
});
