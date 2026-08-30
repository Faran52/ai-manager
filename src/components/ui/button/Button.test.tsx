import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { Button } from './Button';

import type { ButtonProps } from './Button';

describe('Button', () => {
  test('renders its children as a pressable button', async () => {
    const onClick = vi.fn();

    render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Go' }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  test('passes pressed and disabled semantics through', () => {
    render(
      <Button pressed disabled title="hold">
        Hold
      </Button>,
    );

    const button = screen.getByRole<HTMLButtonElement>('button');

    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.getAttribute('title')).toBe('hold');
    expect(button.disabled).toBe(true);
  });

  test('renders every variant and size without crashing', () => {
    const variants: readonly NonNullable<ButtonProps['variant']>[] = ['primary', 'subtle', 'ghost'];
    const sizes: readonly NonNullable<ButtonProps['size']>[] = ['sm', 'md'];

    for (const variant of variants) {
      for (const size of sizes) {
        render(
          <Button variant={variant} size={size}>
            {`${variant}-${size}`}
          </Button>,
        );
      }
    }

    expect(screen.getAllByRole('button')).toHaveLength(6);
  });
});
