import { render, screen } from '@testing-library/react';
import {
  describe,
  expect,
  test,
} from 'vitest';

import { AssistantTurn } from './AssistantTurn';

import type { AssistantTurnEntry } from '@services/history/historyService';

const turn = (blocks: AssistantTurnEntry['blocks'], over?: Partial<AssistantTurnEntry>): AssistantTurnEntry => {
  return {
    kind: 'assistant',
    uuid: 'a1',
    timestamp: 't',
    sidechain: false,
    model: 'claude-sonnet-5',
    usage: {
      inputTokens: 1,
      outputTokens: 22,
      cacheCreationTokens: 0,
      cacheReadTokens: 33,
    },
    costUsd: 0.25,
    blocks,
    ...over,
  };
};

describe('AssistantTurn', () => {
  test('names the model and hides its usage behind a title', () => {
    render(
      <AssistantTurn
        entry={turn([{
          blockType: 'text',
          text: 'hello',
        }])}
        outcomeFor={() => {
          return undefined;
        }}
      />,
    );

    const model = screen.getByText('claude-sonnet-5');

    expect(model.getAttribute('title')).toContain('22 out');
    expect(model.getAttribute('title')).toContain('33 cached');
    expect(model.getAttribute('title')).toContain('$0.25');
    expect(screen.getByText('Assistant')).toBeDefined();
    expect(screen.getByText('hello')).toBeDefined();
  });

  test('dispatches thinking, redacted and tool-use blocks', () => {
    render(
      <AssistantTurn
        entry={turn([
          {
            blockType: 'thinking',
            thinking: 'deep thought',
          },
          { blockType: 'redacted' },
          {
            blockType: 'tool-use',
            call: {
              id: 'tu1',
              name: 'Bash',
              input: {
                kind: 'bash',
                command: 'ls',
              },
            },
          },
        ])}
        outcomeFor={() => {
          return {
            toolUseId: 'tu1',
            status: 'error',
            images: [],
            text: undefined,
          };
        }}
      />,
    );

    expect(screen.getAllByText('Thinking')).toHaveLength(2);
    expect(screen.getAllByText('Bash').length).toBeGreaterThan(0);
    expect(screen.getByText('Error')).toBeDefined();
  });

  test('hides the chip row when no metadata exists', () => {
    render(
      <AssistantTurn
        entry={turn([], {
          model: undefined,
          usage: undefined,
          costUsd: undefined,
        })}
        outcomeFor={() => {
          return undefined;
        }}
      />,
    );

    expect(screen.queryByText(/out/)).toBeNull();
  });
});
