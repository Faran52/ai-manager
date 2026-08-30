import { render, screen } from '@testing-library/react';
import {
  describe,
  expect,
  test,
} from 'vitest';

import { Spinner } from './Spinner';

describe('Spinner', () => {
  test('exposes a loading status', () => {
    render(<Spinner />);

    expect(screen.getByRole('status')).toBeDefined();
  });
});
