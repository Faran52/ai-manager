import {
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ExportMenu } from './ExportMenu';

test('opens the available export actions', async () => {
  render(<ExportMenu entries={[]} project="project" title="Session" />);

  await userEvent.click(screen.getByRole('button', { name: /Export/u }));

  expect(screen.getByRole('menuitem', { name: 'Copy markdown' })).toBeDefined();
  expect(screen.getByRole('menuitem', { name: 'Markdown file' })).toBeDefined();
  expect(screen.getByRole('menuitem', { name: 'HTML file' })).toBeDefined();
  expect(screen.getByRole('menuitem', { name: 'JSON file' })).toBeDefined();
});

test('stays closed when the trigger is double-clicked', async () => {
  render(<ExportMenu entries={[]} project="project" title="Session" />);

  await userEvent.dblClick(screen.getByRole('button', { name: /Export/u }));

  await waitFor(() => {
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
