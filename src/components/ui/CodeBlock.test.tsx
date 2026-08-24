import { render, screen } from '@testing-library/react';

import { CodeBlock } from './CodeBlock';

test('highlights a fenced code block', () => {
  render(<CodeBlock code="const answer = 42;" language="typescript" />);

  expect(screen.getByText('answer')).toBeDefined();
  expect(document.querySelector('pre')).not.toBeNull();
});

test('renders repeated and empty lines without key collisions', () => {
  render(<CodeBlock code={'}\n}\n\n}'} language="typescript" />);

  const lines = document.querySelectorAll('.token-line');

  expect(lines).toHaveLength(4);
});
