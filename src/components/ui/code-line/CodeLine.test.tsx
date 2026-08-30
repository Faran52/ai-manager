import { render, screen } from '@testing-library/react';

import { CodeLine } from './CodeLine';

test('renders preformatted tool text', () => {
  render(<CodeLine text={'first\nsecond'} />);

  expect(screen.getByText(/first/u)).toBeDefined();
  expect(document.querySelector('[data-code-line]')).not.toBeNull();
});
