import { render, screen } from '@testing-library/react';

import { RowsList } from './RowsList';

test('renders labelled tool input rows', () => {
  render(
    <RowsList rows={[{
      label: 'file',
      value: '/a.ts',
    }]}
    />,
  );

  expect(screen.getByText('file')).toBeDefined();
  expect(screen.getByText('/a.ts')).toBeDefined();
});
