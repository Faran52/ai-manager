import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { Panel } from './Panel';

test('heads the surface with its title, as a heading', () => {
  render(<Panel title="Usage"><p>Body</p></Panel>);

  expect(screen.getByRole('heading', { name: 'Usage' })).toBeDefined();
  expect(screen.getByText('Body')).toBeDefined();
});

test('draws an untitled surface with no empty heading in it', () => {
  render(<Panel><p>Body</p></Panel>);

  expect(screen.getByText('Body')).toBeDefined();
  expect(screen.queryByRole('heading')).toBeNull();
});
