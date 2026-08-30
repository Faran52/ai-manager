import { render, screen } from '@testing-library/react';

import { BarRow } from './BarRow';

test('renders a proportional bar with the injected formatter', () => {
  const { rerender } = render(
    <ul>
      <BarRow
        label="Bash"
        value={25}
        max={100}
        formatValue={(value) => {
          return String(value);
        }}
      />
    </ul>,
  );

  expect(screen.getByText('Bash')).toBeDefined();
  expect(screen.getByText('25')).toBeDefined();

  rerender(
    <ul>
      <BarRow
        label="Empty"
        value={0}
        max={0}
        formatValue={(value) => {
          return String(value);
        }}
      />
    </ul>,
  );
  expect(screen.getByText('Empty')).toBeDefined();
});
