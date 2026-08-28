import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { MessageHeader } from './MessageHeader';

test('names the role and shows a readable clock with the full date behind it', () => {
  render(<MessageHeader roleKey="user" timestamp="2026-06-01T14:32:00Z" />);

  expect(screen.getByText('User')).toBeDefined();

  const time = document.querySelector('time');

  expect(time?.textContent).toMatch(/^\d{2}:\d{2}$/u);
  expect(time?.getAttribute('datetime')).toBe('2026-06-01T14:32:00Z');
  expect(time?.getAttribute('title')).toContain('2026');
});

test('omits the clock for a timestamp it cannot read', () => {
  render(<MessageHeader roleKey="user" timestamp="whenever" />);

  expect(screen.getByText('User')).toBeDefined();
  expect(document.querySelector('time')).toBeNull();
});

test('marks a sidechain turn as a branch', () => {
  render(<MessageHeader roleKey="assistant" timestamp="2026-06-01T14:32:00Z" sidechain />);

  expect(screen.getByText('branch')).toBeDefined();
});

test('shortens the model and puts its usage in the title', () => {
  render(
    <MessageHeader
      roleKey="assistant"
      timestamp="2026-06-01T14:32:00Z"
      model="openrouter/anthropic/claude-opus-5"
      usage={{
        inputTokens: 11,
        outputTokens: 22,
        cacheCreationTokens: 0,
        cacheReadTokens: 33,
      }}
      costUsd={0.25}
    />,
  );

  const model = screen.getByText('claude-opus-5');
  const title = model.getAttribute('title') ?? '';

  expect(title).toContain('openrouter/anthropic/claude-opus-5');
  expect(title).toContain('11 in');
  expect(title).toContain('22 out');
  expect(title).toContain('33 cached');
  expect(title).toContain('$0.25');
});

test('titles a model with no usage by its own name alone', () => {
  render(<MessageHeader roleKey="assistant" timestamp="2026-06-01T14:32:00Z" model="opus" />);

  expect(screen.getByText('opus').getAttribute('title')).toBe('opus');
});

test('leaves out a cost and cache that were never recorded', () => {
  render(
    <MessageHeader
      roleKey="assistant"
      timestamp="2026-06-01T14:32:00Z"
      model="opus"
      usage={{
        inputTokens: 1,
        outputTokens: 2,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
      }}
      costUsd={0}
    />,
  );

  const title = screen.getByText('opus').getAttribute('title') ?? '';

  expect(title).not.toContain('cached');
  expect(title).not.toContain('$');
});
