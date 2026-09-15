import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { ReportSection } from './ReportSection';

test('heads its panels with the section name', () => {
  render(
    <ReportSection title="Cost" index={1}>
      <p>panel</p>
    </ReportSection>,
  );

  expect(screen.getByRole('heading', { name: 'Cost' })).toBeDefined();
  expect(screen.getByText('panel')).toBeDefined();
});
