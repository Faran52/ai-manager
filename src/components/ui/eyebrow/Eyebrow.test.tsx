import { render, screen } from '@testing-library/react';
import {
  describe,
  expect,
  test,
} from 'vitest';

import { Eyebrow } from './Eyebrow';

describe('Eyebrow', () => {
  test('is a span by default', () => {
    render(<Eyebrow>Overview</Eyebrow>);

    expect(screen.getByText('Overview').tagName).toBe('SPAN');
  });

  test('takes the element and tone it is given', () => {
    render(<Eyebrow as="h3" tone="warn">Rules</Eyebrow>);

    expect(screen.getByRole('heading', {
      level: 3,
      name: 'Rules',
    })).toBeDefined();
  });
});
