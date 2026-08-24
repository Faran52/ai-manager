import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { AgentTag } from './AgentTag';

test('labels a agent with its visual identity', () => {
  render(<AgentTag agent="copilot" />);

  const tag = screen.getByText('GitHub Copilot');

  expect(tag.getAttribute('data-agent')).toBe('copilot');
  expect(tag.getAttribute('title')).toBe('GitHub Copilot');
});
