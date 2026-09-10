import {
  describe,
  expect,
  test,
} from 'vitest';

import {
  hasMarkdownMarkup,
  isBoxArt,
  normalizeBoxDrawing,
  unwrapFileRefs,
} from './markdownUtils';

const lines = (...parts: readonly string[]): string => {
  return parts.join('\n');
};

describe('hasMarkdownMarkup', () => {
  test('flags a heading', () => {
    expect(hasMarkdownMarkup('# Report\n\nthe body follows')).toBe(true);
  });

  test('flags a fenced code block', () => {
    expect(hasMarkdownMarkup('here you go\n```ts\nconst a = 1\n```')).toBe(true);
  });

  test('flags a blockquote', () => {
    expect(hasMarkdownMarkup('> quoted from somewhere else')).toBe(true);
  });

  test('flags a thematic break', () => {
    expect(hasMarkdownMarkup('above the line\n\n---\n\nbelow the line')).toBe(true);
  });

  test('flags a box-drawing table', () => {
    expect(hasMarkdownMarkup('┌───┬───┐\n│ a │ b │\n└───┴───┘')).toBe(true);
  });

  test('flags an attached-file envelope', () => {
    expect(hasMarkdownMarkup('<path>/x/a.ts</path>\n<type>file</type>\n<content>\ncode\n</content>')).toBe(true);
  });

  test('flags a list of two or more items', () => {
    expect(hasMarkdownMarkup('Findings\n- first issue\n- second issue')).toBe(true);
  });

  test('keeps a single bullet line in a log as plain text', () => {
    expect(hasMarkdownMarkup('Building project\n- 1 warning suppressed\nBuild finished')).toBe(false);
  });

  test('keeps prose with incidental punctuation as plain text', () => {
    expect(hasMarkdownMarkup('run cat a.md | grep foo, then x * 2 * y for the total')).toBe(false);
  });

  test('treats an empty string as plain text', () => {
    expect(hasMarkdownMarkup('')).toBe(false);
  });
});

describe('normalizeBoxDrawing', () => {
  test('rewrites a two-column box-drawing table as a gfm table', () => {
    const table = lines(
      '┌──────┬──────┐',
      '│ Name │ Kind │',
      '├──────┼──────┤',
      '│ foo  │ bar  │',
      '└──────┴──────┘',
    );

    expect(normalizeBoxDrawing(table)).toBe(lines(
      '',
      '| Name | Kind |',
      '| --- | --- |',
      '| foo | bar |',
      '',
    ));
  });

  test('joins a cell that wrapped across several lines of one row', () => {
    const table = lines(
      '┌────────┬───────────┐',
      '│ Piece  │ Role      │',
      '├────────┼───────────┤',
      '│ parser │ reads the │',
      '│        │ raw text  │',
      '└────────┴───────────┘',
    );

    expect(normalizeBoxDrawing(table)).toContain('| parser | reads the raw text |');
  });

  test('ignores a block-element line sitting inside a table run', () => {
    const table = lines(
      '┌──────┬──────┐',
      '│ a    │ b    │',
      '████████████████',
      '│ c    │ d    │',
      '└──────┴──────┘',
    );

    expect(normalizeBoxDrawing(table)).toContain('| a | b |');
  });

  test('reads a table drawn with only an outer border, one row per line', () => {
    const table = lines(
      '┌──────┬──────┐',
      '│ a    │ b    │',
      '│ c    │ d    │',
      '└──────┴──────┘',
    );

    expect(normalizeBoxDrawing(table)).toBe(lines(
      '',
      '| a | b |',
      '| --- | --- |',
      '| c | d |',
      '',
    ));
  });

  test('keeps a box character inside a cell from splitting the column', () => {
    const table = lines(
      '┌────────────┬──────┐',
      '│ a ┌│─ b    │ c    │',
      '├────────────┼──────┤',
      '│ x          │ y    │',
      '└────────────┴──────┘',
    );

    expect(normalizeBoxDrawing(table)).toContain('| a ┌│─ b | c |');
  });

  test('escapes a pipe that appears in cell text', () => {
    const table = lines(
      '┌─────────┬──────┐',
      '│ a || b  │ c    │',
      '├─────────┼──────┤',
      '│ d       │ e    │',
      '└─────────┴──────┘',
    );

    expect(normalizeBoxDrawing(table)).toContain('| a \\|\\| b | c |');
  });

  test('fences a one-column box, which is not a table', () => {
    const box = lines('┌──┐', '│ a │', '└──┘');

    expect(normalizeBoxDrawing(`intro\n${box}\noutro`)).toBe(`intro\n\`\`\`\n${box}\n\`\`\`\noutro`);
  });

  test('fences a single-row box rather than making a one-row table', () => {
    const box = lines('┌──────┬──────┐', '│ a    │ b    │', '└──────┴──────┘');

    expect(normalizeBoxDrawing(box)).toContain('```');
  });

  test('fences file-tree output that trails off the end of the text', () => {
    const input = lines('src/', '├── lib/', '│   └── util.ts', '└── index.ts');
    const expected = lines('src/', '```', '├── lib/', '│   └── util.ts', '└── index.ts', '```');

    expect(normalizeBoxDrawing(input)).toBe(expected);
  });

  test('fences bare pipe rows with no border to read a rule from', () => {
    const rows = lines('│ a │ b │', '│ c │ d │');

    expect(normalizeBoxDrawing(rows)).toBe(lines('```', '│ a │ b │', '│ c │ d │', '```'));
  });

  test('leaves a single box-drawing line as prose', () => {
    expect(normalizeBoxDrawing('the │ splits the two columns')).toBe('the │ splits the two columns');
  });

  test('does not fence a table that already sits inside a code block', () => {
    const input = lines('```', '┌──┐', '└──┘', '```');

    expect(normalizeBoxDrawing(input)).toBe(input);
  });

  test('leaves text with no box-drawing untouched', () => {
    expect(normalizeBoxDrawing('# Heading\n\nplain prose\n')).toBe('# Heading\n\nplain prose\n');
  });
});

describe('unwrapFileRefs', () => {
  test('rewrites a markdown file to its path over its rendered body', () => {
    const ref = lines(
      '<path>/x/notes.md</path>',
      '<type>file</type>',
      '<content>',
      '1: # Title',
      '2: body',
      '</content>',
    );

    expect(unwrapFileRefs(ref)).toBe('`/x/notes.md`\n\n# Title\nbody');
  });

  test('fences a non-markdown file so its punctuation stays literal', () => {
    const ref = lines(
      '<path>/x/a.ts</path>',
      '<type>file</type>',
      '<content>',
      '1: const a = 1;',
      '</content>',
    );

    expect(unwrapFileRefs(ref)).toBe('`/x/a.ts`\n\n```\nconst a = 1;\n```');
  });

  test('leaves text with no envelope untouched', () => {
    expect(unwrapFileRefs('just a sentence with <angle> brackets')).toBe('just a sentence with <angle> brackets');
  });
});

describe('isBoxArt', () => {
  test('flags a box-drawing table', () => {
    expect(isBoxArt('┌──┐\n│ a │\n└──┘')).toBe(true);
  });

  test('flags file-tree output', () => {
    expect(isBoxArt('src/\n└── index.ts')).toBe(true);
  });

  test('does not flag plain code', () => {
    expect(isBoxArt('const total = a - b;')).toBe(false);
  });
});
