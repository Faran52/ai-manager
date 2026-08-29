import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { FileChangeBody } from './FileChangeBody';

test('shows a written file as an addition throughout', () => {
  render(
    <FileChangeBody
      input={{
        kind: 'file-write',
        path: '/repo/new.ts',
        content: 'first\nsecond',
      }}
    />,
  );

  expect(screen.getByText('/repo/new.ts')).toBeDefined();
  expect(screen.getByText('+first')).toBeDefined();
  expect(screen.getByText('+second')).toBeDefined();
});

test('shows an edit as the replacement it is', () => {
  render(
    <FileChangeBody
      input={{
        kind: 'file-edit',
        path: '/repo/a.ts',
        oldString: 'const a = 1;',
        newString: 'const a = 2;',
        replaceAll: false,
      }}
    />,
  );

  expect(screen.getByText('-const a = 1;')).toBeDefined();
  expect(screen.getByText('+const a = 2;')).toBeDefined();
});

test('shows every edit of a batch', () => {
  render(
    <FileChangeBody
      input={{
        kind: 'multi-edit',
        path: '/repo/a.ts',
        edits: [
          {
            oldString: 'one',
            newString: 'uno',
            replaceAll: false,
          },
          {
            oldString: 'two',
            newString: 'dos',
            replaceAll: false,
          },
        ],
      }}
    />,
  );

  expect(screen.getByText('-one')).toBeDefined();
  expect(screen.getByText('+dos')).toBeDefined();
});

test('says so when the call described no change at all', () => {
  render(
    <FileChangeBody
      input={{
        kind: 'file-edit',
        path: '/repo/a.ts',
        oldString: 'same',
        newString: 'same',
        replaceAll: false,
      }}
    />,
  );

  expect(screen.getByText('No change was described.')).toBeDefined();
});
