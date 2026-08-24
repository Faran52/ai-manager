import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { MessageTimeline } from './MessageTimeline';

import type { HistoryEntry } from '@services/history/historyService';

const entries: HistoryEntry[] = [
  {
    kind: 'user',
    uuid: 'u1',
    timestamp: 't1',
    sidechain: false,
    meta: false,
    text: 'question',
    outcomes: [{
      toolUseId: 'tu1',
      status: 'error',
      images: [],
      text: undefined,
    }],
  },
  {
    kind: 'assistant',
    uuid: 'a1',
    timestamp: 't2',
    sidechain: false,
    model: 'm',
    blocks: [{
      blockType: 'text',
      text: 'answer',
    }],
  },
  {
    kind: 'assistant',
    uuid: 'a2',
    timestamp: 't3',
    sidechain: true,
    blocks: [{
      blockType: 'tool-use',
      call: {
        id: 'tu1',
        name: 'Bash',
        input: {
          kind: 'bash',
          command: 'ls',
        },
      },
    }],
  },
  {
    kind: 'summary',
    text: 'recap line',
  },
];

describe('MessageTimeline', () => {
  test('orders turns and dims sidechain content', () => {
    render(<MessageTimeline entries={entries} />);

    expect(screen.getByText('question')).toBeDefined();
    expect(screen.getByText('answer')).toBeDefined();
    expect(screen.getByText('recap line')).toBeDefined();

    const wrappers = document.querySelectorAll('[data-message-timeline] > div');

    expect(wrappers[2]?.className).toContain('opacity-60');
  });

  test('pairs tool results onto their calls inside the timeline', async () => {
    render(<MessageTimeline entries={entries} />);
    const button = screen.getAllByRole<HTMLButtonElement>('button').at(0);

    if (button != null) {
      await userEvent.click(button);
    }

    expect(screen.getByText('error')).toBeDefined();
  });
});

describe('MessageTimeline extra kinds', () => {
  test('renders system notices and plain users without outcomes', () => {
    const extended: HistoryEntry[] = [
      ...entries,
      {
        kind: 'system',
        uuid: 's9',
        timestamp: 't9',
        sidechain: false,
        level: undefined,
        subtype: undefined,
        text:
  'notice',
      },
      {
        kind: 'user',
        uuid: 'u2',
        timestamp: 't2b',
        sidechain: false,
        meta: false,
        text: 'plain',
        outcomes: [],
      },
    ];

    render(<MessageTimeline entries={extended} />);

    expect(screen.getByText('notice')).toBeDefined();
  });
});

describe('MessageTimeline summary keys', () => {
  test('renders repeated summary texts without duplicate-key errors', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(vi.fn());

    try {
      render(
        <MessageTimeline entries={[
          {
            kind: 'user',
            uuid: 'u1',
            timestamp: 't1',
            sidechain: false,
            meta: false,
            text: 'hi',
            outcomes: [],
          },
          {
            kind: 'summary',
            text: 'Conversation compacted',
          },
          {
            kind: 'summary',
            text: 'Conversation compacted',
          },
        ]}
        />,
      );

      expect(screen.getAllByText('Conversation compacted')).toHaveLength(2);
      expect(errorSpy.mock.calls.filter((call) => {
        return call.some((argument) => {
          return typeof argument === 'string' && argument.includes('same key');
        });
      })).toEqual([]);
    }
    finally {
      errorSpy.mockRestore();
    }
  });
});
