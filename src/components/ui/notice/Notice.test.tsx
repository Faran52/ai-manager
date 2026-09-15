import { render, screen } from '@testing-library/react';
import {
  describe,
  expect,
  test,
} from 'vitest';

import { Notice } from './Notice';

describe('Notice', () => {
  test('reads as an error by default', () => {
    render(<Notice>disk full</Notice>);

    expect(screen.getByText('disk full').getAttribute('data-tone')).toBe('error');
  });

  test('carries the warn tone when asked', () => {
    render(<Notice tone="warn">read-only</Notice>);

    expect(screen.getByText('read-only').getAttribute('data-tone')).toBe('warn');
  });
});
