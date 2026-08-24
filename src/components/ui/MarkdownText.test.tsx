import { render, screen } from '@testing-library/react';
import {
  describe,
  expect,
  test,
} from 'vitest';

import { MarkdownText } from './MarkdownText';

describe('MarkdownText', () => {
  test('renders paragraphs, emphasis and lists from gfm markdown', () => {
    render(<MarkdownText text={'# Title\n\n- one\n- two\n\n**bold** and _italics_\n'} />);

    expect(screen.getByText('Title')).toBeDefined();
    expect(screen.getByText('one')).toBeDefined();
    expect(screen.getByText('two')).toBeDefined();
    expect(screen.getByText('bold')).toBeDefined();
  });

  test('highlights fenced code blocks with their language', () => {
    render(<MarkdownText text={'```ts\nconst x = 1;\n```\n'} />);

    const pre = document.querySelector('pre');

    expect(pre?.className).toContain('overflow-x-auto');
    expect(pre?.textContent).toContain('const x');
  });

  test('styles inline code distinctly from blocks', () => {
    render(<MarkdownText text={'Use `pnpm check` locally.\n\n```js\nlet y;\n```\n'} />);

    const inline = screen.getByText('pnpm check');

    expect(inline.className).toContain('rounded');

    expect(document.querySelector('pre')?.textContent).toContain('let y');
  });

  test('opens links in new tabs safely', () => {
    render(<MarkdownText text={'[docs](https://example.com)\n'} />);

    const link = screen.getByText('docs');

    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noreferrer');
  });
});

describe('textOf fallbacks', () => {
  test('handles fences without a language and element children', () => {
    render(<MarkdownText text={'```\nplain block\n}\n```\n'} />);

    expect(document.querySelector('pre')?.textContent).toContain('plain block');
  });
});

describe('textOf node shapes', () => {
  test('flattens multi-part inline code children', () => {
    render(<MarkdownText text={'Use `a *b* c` now.\n'} />);

    expect(screen.getByText('a *b* c')).toBeDefined();
  });

  test('flattens multiline fenced children arrays', () => {
    render(<MarkdownText text={'```ts\nconst a = 1;\nconst b = 2;\n```\n'} />);

    expect(document.querySelector('pre')?.textContent).toContain('const b');
  });
});
