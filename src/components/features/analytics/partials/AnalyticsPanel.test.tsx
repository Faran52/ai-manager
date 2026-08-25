import { render, screen } from '@testing-library/react';

import { AnalyticsPanel } from './AnalyticsPanel';

test('renders a titled analytics surface', () => {
  render(<AnalyticsPanel title="Usage"><p>Body</p></AnalyticsPanel>);

  expect(screen.getByRole('heading', { name: 'Usage' })).toBeDefined();
  expect(screen.getByText('Body')).toBeDefined();
});
