import { render, screen } from '@testing-library/react';

import { AgentMark } from './AgentMark';

test('draws the agent initials on the agent hue', () => {
  render(<AgentMark agent="claude" className="size-7" />);

  const mark = screen.getByText('CC');

  expect(mark.getAttribute('data-agent')).toBe('claude');
  expect(mark.className).toContain('size-7');
});

test('keeps two letters of a single-word agent name', () => {
  render(<AgentMark agent="kimi" />);

  expect(screen.getByText('Ki')).toBeDefined();
});
