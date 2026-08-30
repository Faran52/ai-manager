import { render, screen } from '@testing-library/react';

import { TruncatedText } from './TruncatedText';

test('collapses long tool output behind its label', () => {
  const { rerender } = render(<TruncatedText label="output" text="short" />);

  expect(screen.getByText('short')).toBeDefined();

  rerender(<TruncatedText label="output" text={'x'.repeat(4_001)} />);
  expect(screen.getByText(/output/u)).toBeDefined();
});
