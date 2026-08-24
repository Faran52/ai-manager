import { render, screen } from '@testing-library/react';

import { OutcomeBody } from './OutcomeBody';

test('renders outcome text, errors and images while allowing an empty result', () => {
  const { rerender } = render(
    <OutcomeBody outcome={{
      toolUseId: 't',
      status: 'error',
      text: 'output',
      stderr: 'failure',
      images: [{ url: 'https://example.com/image.png' }],
    }}
    />,
  );

  expect(screen.getByText('output')).toBeDefined();
  expect(screen.getByText('failure')).toBeDefined();
  expect(screen.getByRole('img')).toBeDefined();

  rerender(
    <OutcomeBody outcome={{
      toolUseId: 't',
      status: 'ok',
      images: [],
    }}
    />,
  );
  expect(document.body.textContent).toBe('');
});
