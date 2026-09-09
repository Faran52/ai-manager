import { render, screen } from '@testing-library/react';
import {
  describe,
  expect,
  test,
} from 'vitest';

import { PatchView } from './PatchView';

import type { PatchHunk } from '@services/history/historyService';

const hunk: PatchHunk = {
  oldStart: 3,
  oldLines: 2,
  newStart: 3,
  newLines: 4,
  lines: [' const a', '-const b', '+const c'],
};

describe('PatchView', () => {
  test('renders hunk headers and classified diff rows', () => {
    render(<PatchView hunks={[hunk]} />);

    expect(screen.getByText(/@@ -3,2 \+3,4 @@/)).toBeDefined();
    expect(document.querySelector('[data-diff-kind="add"]')).not.toBeNull();

    const rows = document.querySelectorAll('[data-diff-kind]');
    const kinds = [...rows].map((row) => {
      return row.getAttribute('data-diff-kind');
    });

    expect(kinds).toEqual(['context', 'remove', 'add']);
  });

  test('prefixes every row with its diff marker', () => {
    render(
      <PatchView hunks={[{
        oldStart: 1,
        oldLines: 1,
        newStart: 1,
        newLines: 1,
        lines: ['-x', '+y'],
      }]}
      />,
    );

    expect(screen.getByText('-x')).toBeDefined();
    expect(screen.getByText('+y')).toBeDefined();
  });

  test('shows no file header when the hunks name no file', () => {
    render(<PatchView hunks={[hunk]} />);

    expect(document.querySelector('[data-patch-file]')).toBeNull();
  });

  test('heads each file once when a patch spans more than one', () => {
    render(
      <PatchView hunks={[
        {
          ...hunk,
          file: 'src/a.ts',
          lines: ['-a', '+A'],
        },
        {
          ...hunk,
          file: 'src/a.ts',
          lines: [' still a'],
        },
        {
          ...hunk,
          file: 'src/b.ts',
          lines: ['-b', '+B'],
        },
      ]}
      />,
    );

    const headers = [...document.querySelectorAll('[data-patch-file]')].map((node) => {
      return node.textContent;
    });

    expect(headers).toEqual(['src/a.ts', 'src/b.ts']);
  });
});
