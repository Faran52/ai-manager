import { render, screen } from '@testing-library/react';

import { SectionHeader } from './SectionHeader';

test('renders a labelled section icon and action', () => {
  render(<SectionHeader icon={<i>icon</i>} label="Projects" action={<button type="button">Action</button>} />);

  expect(screen.getByText('icon')).toBeDefined();
  expect(screen.getByText('Projects')).toBeDefined();
  expect(screen.getByRole('button', { name: 'Action' })).toBeDefined();
});
