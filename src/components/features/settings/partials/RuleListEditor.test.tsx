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

test('keeps the field behind Add and closes it again on cancel', async () => {
  renderEditor([]);

  expect(screen.queryByLabelText('Add a rule to Allowed')).toBeNull();

  await userEvent.click(screen.getByTitle('Add a rule to Allowed'));
  expect(screen.getByLabelText('Add a rule to Allowed')).toBeDefined();

  await userEvent.click(screen.getByText('Cancel'));
  expect(screen.queryByLabelText('Add a rule to Allowed')).toBeNull();
});

test('adds a trimmed rule on Enter and closes the field', async () => {
  const onChange = renderEditor([]);

  await userEvent.click(screen.getByTitle('Add a rule to Allowed'));
  await userEvent.type(screen.getByLabelText('Add a rule to Allowed'), '  Bash(ls:*)  {Enter}');

  expect(onChange).toHaveBeenCalledWith(['Bash(ls:*)']);
  expect(screen.queryByLabelText('Add a rule to Allowed')).toBeNull();
});

test('refuses a blank and a duplicate rule', async () => {
  const onChange = renderEditor(['Bash(ls:*)']);

  await userEvent.click(screen.getByTitle('Add a rule to Allowed'));
  const field = screen.getByLabelText('Add a rule to Allowed');

  expect(screen.getByText('Add').closest('button')?.disabled).toBe(true);

  await userEvent.type(field, 'Bash(ls:*)');
  expect(screen.getByText('Add').closest('button')?.disabled).toBe(true);

  // Enter routes through the same guard, so it cannot bypass the disabled button.
  await userEvent.type(field, '{Enter}');
  expect(onChange).not.toHaveBeenCalled();
});

test('removes the rule it is asked to', async () => {
  const onChange = renderEditor(['Bash(ls:*)', 'Bash(rm:*)']);

  await userEvent.click(screen.getByLabelText('Remove Bash(rm:*)'));

  expect(onChange).toHaveBeenCalledWith(['Bash(ls:*)']);
});
