import { render, screen } from '@testing-library/react';
import {
  describe,
  expect,
  test,
} from 'vitest';

import { BarList } from './BarList';

describe('BarList', () => {
  test('scales bars against the largest value', () => {
    render(
      <BarList
        title="Tools"
        items={[
          {
            label: 'Bash',
            value: 10,
          },
          {
            label: 'Read',
            value: 5,
          },
        ]}
      />,
    );

    expect(screen.getByText('Bash')).toBeDefined();
    const bars = document.querySelectorAll<HTMLElement>('[data-bar-list] span.block');
    const widths = [...bars].map((bar) => {
      return bar.style.width;
    });

    expect(widths.at(0)).toBe('100%');
    expect(widths.at(1)).toBe('50%');
  });

  test('explains itself when empty', () => {
    render(<BarList title="Tools" items={[]} />);

    expect(screen.getByText('Nothing recorded yet.')).toBeDefined();
  });
});

describe('BarList zero values', () => {
  test('renders a zero-width bar when every value is zero', () => {
    render(
      <BarList
        title="Tools"
        items={[{
          label: 'Bash',
          value: 0,
        }]}
      />,
    );

    const bar = document.querySelectorAll<HTMLElement>('[data-bar-list] span.block')[0];

    expect(bar?.style.width).toBe('0%');
  });
});
