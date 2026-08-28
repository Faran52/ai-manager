import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  expect,
  test,
  vi,
} from 'vitest';

import { RuleListEditor } from './RuleListEditor';

const renderEditor = (rules: readonly string[], onChange = vi.fn()) => {
  render(
    <RuleListEditor
      label="Allowed"
      hint="Tools that run without a prompt."
      placeholder="Bash(git status:*)"
      rules={rules}
      onChange={onChange}
    />,
  );

  return onChange;
};

test('lists the rules it was given with their heading', () => {
  renderEditor(['Bash(ls:*)']);

  expect(screen.getByText('Allowed')).toBeDefined();
  expect(screen.getByText('Bash(ls:*)')).toBeDefined();
});

test('adds a trimmed rule and clears the field', async () => {
  const onChange = renderEditor([]);

  await userEvent.type(screen.getByLabelText('Add a rule to Allowed'), '  Bash(ls:*)  ');
  await userEvent.click(screen.getByText('Add'));

  expect(onChange).toHaveBeenCalledWith(['Bash(ls:*)']);
  expect(screen.getByLabelText<HTMLInputElement>('Add a rule to Allowed').value).toBe('');
});

test('refuses a blank and a duplicate rule', async () => {
  const onChange = renderEditor(['Bash(ls:*)']);
  const field = screen.getByLabelText('Add a rule to Allowed');

  expect(screen.getByText('Add').closest('button')?.disabled).toBe(true);

  await userEvent.type(field, 'Bash(ls:*)');
  expect(screen.getByText('Add').closest('button')?.disabled).toBe(true);

  expect(onChange).not.toHaveBeenCalled();
});

test('removes the rule it is asked to', async () => {
  const onChange = renderEditor(['Bash(ls:*)', 'Bash(rm:*)']);

  await userEvent.click(screen.getByLabelText('Remove Bash(rm:*)'));

  expect(onChange).toHaveBeenCalledWith(['Bash(ls:*)']);
});
