import { render, screen } from '@testing-library/react';

import { WebOutcomeBody } from './WebOutcomeBody';

test('lists the distinct hosts a result cites and keeps the text', () => {
  render(
    <WebOutcomeBody
      label="Result"
      text="see https://example.com/a, https://example.com/a and https://docs.dev/b."
    />,
  );

  const links = screen.getAllByRole('link');

  expect(links).toHaveLength(2);
  expect(links[0]?.getAttribute('href')).toBe('https://example.com/a');
  expect(screen.getByText('docs.dev')).toBeDefined();
  expect(screen.getByText(/see https/)).toBeDefined();
});

test('drops an unparseable match and caps the list at six', () => {
  const many = Array.from({ length: 8 }, (_, index) => {
    return `https://host${String(index)}.dev/x`;
  }).join(' ');

  render(<WebOutcomeBody label="Result" text={`https://) ${many}`} />);

  expect(screen.getAllByRole('link')).toHaveLength(6);
  expect(screen.queryByText('host7.dev')).toBeNull();
});

test('renders text alone when it cites nothing', () => {
  render(<WebOutcomeBody label="Result" text="no citations here" />);

  expect(screen.queryByRole('link')).toBeNull();
  expect(screen.getByText('no citations here')).toBeDefined();
});
