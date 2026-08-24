import { render, screen } from '@testing-library/react';
import {
  describe,
  expect,
  test,
} from 'vitest';

import { SummaryDivider } from './SummaryDivider';

describe('SummaryDivider', () => {
  test('shows the summary text', () => {
    render(<SummaryDivider text="A recap" />);

    expect(screen.getByText('A recap')).toBeDefined();
    expect(document.querySelector('[data-summary-divider]')).not.toBeNull();
  });
});
