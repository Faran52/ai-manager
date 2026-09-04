import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  expect,
  test,
  vi,
} from 'vitest';

import { EnvEditor } from './EnvEditor';

import type { EnvEntry } from '@services/settings/settingsService';

const renderEditor = (entries: readonly EnvEntry[], onChange = vi.fn()) => {
  render(<EnvEditor entries={entries} onChange={onChange} />);

  return onChange;
};

test('lists the variables it was given', () => {
  renderEditor([{
    name: 'ANTHROPIC_MODEL',
    value: 'opus',
  }]);

  expect(screen.getByText('ANTHROPIC_MODEL')).toBeDefined();
  expect(screen.getByLabelText<HTMLInputElement>('Value for ANTHROPIC_MODEL').value).toBe('opus');
});

test('adds a variable and closes the field', async () => {
  const onChange = renderEditor([]);

  expect(screen.queryByLabelText('Variable name')).toBeNull();

  await userEvent.click(screen.getByTitle('Add an environment variable'));
  await userEvent.type(screen.getByLabelText('Variable name'), '  A  ');
  await userEvent.type(screen.getByLabelText('Value'), 'b');
  await userEvent.click(screen.getByText('Add'));

  expect(onChange).toHaveBeenCalledWith([{
    name: 'A',
    value: 'b',
  }]);
  expect(screen.queryByLabelText('Variable name')).toBeNull();
});

test('refuses a blank and a duplicate name, and cancels back out', async () => {
  const onChange = renderEditor([{
    name: 'A',
    value: 'b',
  }]);

  await userEvent.click(screen.getByTitle('Add an environment variable'));
  expect(screen.getByText('Add').closest('button')?.disabled).toBe(true);

  await userEvent.type(screen.getByLabelText('Variable name'), 'A');
  expect(screen.getByText('Add').closest('button')?.disabled).toBe(true);

  // Enter routes through the same guard, so it cannot bypass the disabled button.
  await userEvent.type(screen.getByLabelText('Value'), '{Enter}');
  expect(onChange).not.toHaveBeenCalled();

  await userEvent.click(screen.getByText('Cancel'));
  expect(screen.queryByLabelText('Variable name')).toBeNull();
});

test('edits and removes an existing variable', async () => {
  const onChange = renderEditor([
    {
      name: 'A',
      value: 'b',
    },
    {
      name: 'C',
      value: 'd',
    },
  ]);

  await userEvent.type(screen.getByLabelText('Value for A'), 'x');
  expect(onChange).toHaveBeenCalledWith([
    {
      name: 'A',
      value: 'bx',
    },
    {
      name: 'C',
      value: 'd',
    },
  ]);

  await userEvent.click(screen.getByLabelText('Remove C'));
  expect(onChange).toHaveBeenCalledWith([{
    name: 'A',
    value: 'b',
  }]);
});
