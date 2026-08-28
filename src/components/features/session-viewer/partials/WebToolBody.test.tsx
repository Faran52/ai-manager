import { render, screen } from '@testing-library/react';

import { WebToolBody } from './WebToolBody';

test('shows the query for a search', () => {
  render(
    <WebToolBody input={{
      kind: 'web-search',
      query: 'astro islands',
    }}
    />,
  );

  expect(screen.getByText('astro islands')).toBeDefined();
  expect(screen.getByText('query')).toBeDefined();
});

test('links a fetched url by host and shows the prompt', () => {
  render(
    <WebToolBody input={{
      kind: 'web-fetch',
      url: 'https://example.com/docs',
      prompt: 'summarise it',
    }}
    />,
  );

  const link = screen.getByRole('link');

  expect(link.getAttribute('href')).toBe('https://example.com/docs');
  expect(screen.getByText('example.com')).toBeDefined();
  expect(screen.getByText('summarise it')).toBeDefined();
});

test('renders an unusable url as plain text', () => {
  const { rerender } = render(
    <WebToolBody input={{
      kind: 'web-fetch',
      url: 'not a url',
    }}
    />,
  );

  expect(screen.queryByRole('link')).toBeNull();
  expect(screen.getByText('not a url')).toBeDefined();
  expect(screen.getByText('url')).toBeDefined();

  rerender(
    <WebToolBody input={{
      kind: 'web-fetch',
      url: 'file:///etc/hosts',
      prompt: '',
    }}
    />,
  );
  expect(screen.queryByRole('link')).toBeNull();
  expect(screen.getByText('file:///etc/hosts')).toBeDefined();
});
