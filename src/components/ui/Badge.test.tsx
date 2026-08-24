import { render, screen } from '@testing-library/react';
import {
  describe,
  expect,
  test,
} from 'vitest';

import { Badge } from './Badge';

describe('Badge', () => {
  test('shows text with the default tone', () => {
    render(<Badge>12</Badge>);

    expect(screen.getByText('12')).toBeDefined();
  });

  test('accepts explicit tones and elements', () => {
    render(
      <Badge tone="error">
        <span>err</span>
      </Badge>,
    );

    expect(screen.getByText('err')).toBeDefined();
  });
});
