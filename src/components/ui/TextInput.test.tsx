import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { TextInput } from './TextInput';

describe('TextInput', () => {
  test('reports typed characters through onInput', async () => {
    const onInput = vi.fn();

    render(<TextInput value="" onInput={onInput} label="Filter" placeholder="type" />);
    await userEvent.type(screen.getByLabelText('Filter'), 'a');

    expect(onInput).toHaveBeenCalledWith('a');
  });

  test('shows the current value and applies the extra class name', () => {
    render(
      <TextInput
        value="ab"
        onInput={() => {
          return undefined;
        }}
        label="L"
        className="w-10"
      />,
    );

    const input = screen.getByLabelText<HTMLInputElement>('L');

    expect(input.value).toBe('ab');
    expect(input.className).toContain('w-10');
  });
});
