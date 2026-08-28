import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { defaultMessageFilters } from '../utils/messageFilterUtils';

import { MessageNavigator } from './MessageNavigator';

import type { HistoryEntry } from '@services/history/historyService';

const noop = (): void => {
  return undefined;
};

const entries: readonly HistoryEntry[] = [
  {
    kind: 'user',
    uuid: 'u1',
    timestamp: '2026-05-05T10:00:00Z',
    sidechain: false,
    meta: false,
    text: '  the   question  ',
    outcomes: [],
  },
  {
    kind: 'user',
    uuid: 'u2',
    timestamp: '2026-05-05T10:01:00Z',
    sidechain: false,
    meta: false,
    text: '',
    command: '/review',
    outcomes: [],
  },
  {
    kind: 'assistant',
    uuid: 'a1',
    timestamp: '2026-05-05T10:02:00Z',
    sidechain: false,
    blocks: [{
      blockType: 'text',
      text: 'the answer',
    }],
  },
  {
    kind: 'assistant',
    uuid: 'a2',
    timestamp: '2026-05-05T10:03:00Z',
    sidechain: false,
    blocks: [{
      blockType: 'tool-use',
      call: {
        id: 't1',
        name: 'Bash',
        input: {
          kind: 'bash',
          command: 'ls',
        },
      },
    }],
  },
  {
    kind: 'assistant',
    uuid: 'a3',
    timestamp: '2026-05-05T10:04:00Z',
    sidechain: false,
    blocks: [{ blockType: 'redacted' }],
  },
  {
    kind: 'system',
    uuid: 's1',
    timestamp: '2026-05-05T10:05:00Z',
    sidechain: false,
    text: 'hook ran',
  },
  {
    kind: 'user',
    uuid: 'u3',
    timestamp: '2026-05-05T10:06:00Z',
    sidechain: false,
    meta: true,
    text: '',
    injectedText: 'injected context',
    outcomes: [],
  },
  {
    kind: 'user',
    uuid: 'u4',
    timestamp: '2026-05-05T10:07:00Z',
    sidechain: false,
    meta: false,
    text: '',
    outcomes: [{
      toolUseId: 'orphan',
      status: 'ok',
      images: [],
    }],
  },
  {
    kind: 'summary',
    text: 'the recap',
  },
];

const renderNavigator = (onNavigate = noop): void => {
  render(
    <MessageNavigator
      entries={entries}
      filters={defaultMessageFilters()}
      width={280}
      onNavigate={onNavigate}
      onClose={noop}
    />,
  );
};

test('previews every entry kind and collapses whitespace', () => {
  renderNavigator();

  expect(screen.getByText('the question')).toBeDefined();
  expect(screen.getByText('/review')).toBeDefined();
  expect(screen.getByText('the answer')).toBeDefined();
  expect(screen.getByText('Bash')).toBeDefined();
  expect(screen.getByText('hook ran')).toBeDefined();
  expect(screen.getByText('the recap')).toBeDefined();
  expect(screen.getByText('injected context')).toBeDefined();
  expect(screen.getByText('9')).toBeDefined();
});

test('labels an entry with no preview by its kind', () => {
  renderNavigator();

  expect(screen.getByLabelText('Assistant 5')).toBeDefined();
  expect(screen.getByLabelText('User 8')).toBeDefined();
});

test('jumps to the row it was asked for', async () => {
  const onNavigate = vi.fn();

  renderNavigator(onNavigate);
  await userEvent.click(screen.getByLabelText('Assistant 3'));

  expect(onNavigate).toHaveBeenCalledWith(2);
});

test('filters by preview text and by kind, and reports no match', async () => {
  renderNavigator();

  const search = screen.getByLabelText('Search loaded messages');

  await userEvent.type(search, 'ANSWER');
  expect(screen.getByText('the answer')).toBeDefined();
  expect(screen.queryByText('the question')).toBeNull();

  await userEvent.clear(search);
  await userEvent.type(search, 'summary');
  expect(screen.getByText('the recap')).toBeDefined();

  await userEvent.clear(search);
  await userEvent.type(search, 'nothing here');
  expect(screen.getByText('No matching messages')).toBeDefined();
});

test('closes on request', async () => {
  const onClose = vi.fn();

  render(
    <MessageNavigator
      entries={entries}
      filters={defaultMessageFilters()}
      width={280}
      onNavigate={noop}
      onClose={onClose}
    />,
  );
  await userEvent.click(screen.getByLabelText('Close message navigator'));

  expect(onClose).toHaveBeenCalledTimes(1);
});
