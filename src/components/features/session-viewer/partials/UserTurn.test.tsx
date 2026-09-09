import { render, screen } from '@testing-library/react';
import {
  describe,
  expect,
  test,
} from 'vitest';

import { UserTurn } from './UserTurn';

import type { UserTurnEntry } from '@services/history/historyService';

const base: UserTurnEntry = {
  kind: 'user',
  uuid: 'u1',
  timestamp: '2026-01-01T00:00:00Z',
  sidechain: false,
  meta: false,
  text: 'hello world',
  outcomes: [],
};

describe('UserTurn', () => {
  test('shows the message bubble with a timestamp anchor', () => {
    render(<UserTurn entry={base} agent="claude" orphans={[]} />);

    expect(screen.getByText('hello world')).toBeDefined();
    expect(document.querySelector('[data-timestamp="2026-01-01T00:00:00Z"]')).not.toBeNull();
  });

  test('renders the message as markdown', () => {
    render(
      <UserTurn
        agent="claude"
        entry={{
          ...base,
          text: '## Plan\n\n1. first\n2. second',
        }}
        orphans={[]}
      />,
    );

    expect(screen.getByText('Plan').tagName).toBe('H2');
    expect(screen.getByText('first').closest('ol')).not.toBeNull();
  });

  test('renders slash commands as chips without a bubble', () => {
    render(
      <UserTurn
        agent="claude"
        entry={{
          ...base,
          text: '',
          command: '/compact',
        }}
        orphans={[]}
      />,
    );

    expect(screen.getByText('/compact')).toBeDefined();
    expect(screen.queryByText('hello world')).toBeNull();
  });

  test('marks meta echoes and renders orphan results', () => {
    render(
      <UserTurn
        agent="claude"
        entry={{
          ...base,
          meta: true,
          text: '',
          outcomes: [],
        }}
        orphans={[
          {
            toolUseId: 'tu9',
            status: 'error',
            text: 'trace',
            images: [],
            stderr: undefined,
          },
        ]}
      />,
    );

    expect(document.querySelector('[data-user-turn][data-meta="true"]')).not.toBeNull();
    expect(screen.getByText('trace')).toBeDefined();
  });
});

test('keeps injected context collapsed beside the real user message', () => {
  const { rerender } = render(
    <UserTurn
      agent="claude"
      entry={{
        ...base,
        text: 'Fix this.',
        injectedText: '<environment_context>hidden</environment_context>',
      }}
      orphans={[]}
    />,
  );

  expect(screen.getByText('Fix this.')).toBeDefined();
  expect(screen.getByRole('button', { name: 'Injected context' }).getAttribute('aria-expanded')).toBe('false');
  expect(screen.queryByText('<environment_context>hidden</environment_context>')).toBeNull();

  rerender(
    <UserTurn
      agent="claude"
      entry={{
        ...base,
        text: 'Fix this.',
        injectedText: '<environment_context>hidden</environment_context>',
      }}
      filters={{
        text: false,
        thinking: true,
        tools: true,
        commands: true,
      }}
      orphans={[]}
    />,
  );

  expect(screen.queryByText('Injected context')).toBeNull();
});

describe('UserTurn orphans without text', () => {
  test('skips them instead of rendering empty blocks', () => {
    render(
      <UserTurn
        agent="claude"
        entry={{
          ...base,
          text: '',
        }}
        orphans={[{
          toolUseId: 'tu404',
          status: 'ok',
          images: [],
        }]}
      />,
    );

    expect(screen.queryByText('result')).toBeNull();
  });
});

describe('UserTurn dim meta turns', () => {
  test('dims meta turns that still carry text', () => {
    render(
      <UserTurn
        agent="claude"
        entry={{
          ...base,
          meta: true,
          text: 'echo text',
        }}
        orphans={[]}
      />,
    );

    expect(screen.getByText('echo text').closest('.text-muted-foreground')).not.toBeNull();
    expect(document.querySelector('[data-user-turn][data-meta="true"]')).not.toBeNull();
  });
});

test('shows a screenshot pasted into the turn', () => {
  render(
    <UserTurn
      agent="claude"
      entry={{
        kind: 'user',
        uuid: 'u9',
        timestamp: '2026-06-01T10:00:00Z',
        sidechain: false,
        meta: false,
        text: 'look at this',
        images: [{
          mediaType: 'image/png',
          data: 'QUJD',
        }],
        outcomes: [],
      }}
      orphans={[]}
    />,
  );

  expect(screen.getByText('look at this')).toBeDefined();
  expect(document.querySelector('[data-user-images] img')?.getAttribute('src'))
    .toBe('data:image/png;base64,QUJD');
});
