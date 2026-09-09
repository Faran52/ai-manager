import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  describe,
  expect,
  test,
} from 'vitest';

import { OutputBlock } from './OutputBlock';

const codeLine = (): string | undefined => {
  return document.querySelector('[data-code-line]')?.textContent ?? undefined;
};

const rendersMarkdown = (): boolean => {
  return document.querySelector('[data-markdown]') != null && document.querySelector('[data-code-line]') == null;
};

describe('OutputBlock', () => {
  test('prints plain output on a bare code line', () => {
    render(<OutputBlock label="output" text="localhost:4321 is up" />);

    expect(screen.getByText(/output · 20 chars/u)).toBeDefined();
    expect(codeLine()).toBe('localhost:4321 is up');
  });

  test('renders markdown output parsed, with a switch to raw', async () => {
    render(<OutputBlock label="output" text={'# Report\n\n- one\n- two'} />);

    expect(screen.getByText('Report').tagName).toBe('H1');
    expect(codeLine()).toBeUndefined();

    await userEvent.click(screen.getByRole('radio', { name: 'Raw' }));

    expect(codeLine()).toContain('# Report');
  });

  test('renders a fenced code block', () => {
    render(<OutputBlock label="output" text={'here you go\n```ts\nconst a = 1\n```'} />);

    expect(rendersMarkdown()).toBe(true);
  });

  test('renders a list of two or more items', () => {
    render(<OutputBlock label="output" text={'Findings\n- first issue\n- second issue'} />);

    expect(screen.getByText('first issue').closest('ul')).not.toBeNull();
    expect(codeLine()).toBeUndefined();
  });

  test('keeps a diff hunk literal', () => {
    const diff = '@@ -1,3 +1,3 @@\n const a = 1\n-const b = 2\n+const b = 3';

    render(<OutputBlock label="output" text={diff} />);

    expect(codeLine()).toBe(diff);
  });

  test('keeps a lone bullet in a log literal', () => {
    render(<OutputBlock label="output" text={'Building project\n- 1 warning suppressed\nBuild finished in 4.2s'} />);

    expect(codeLine()).toContain('1 warning suppressed');
  });

  test('keeps a one-line summary with backticks and a link literal', () => {
    render(<OutputBlock label="result" text="Read [`endpoints.ts`](file:///repo/endpoints.ts), lines 1 to 40" />);

    expect(codeLine()).toContain('endpoints.ts');
  });

  test('clips a body past the cap but keeps the true length on the label', () => {
    render(<OutputBlock label="output" text={'x'.repeat(20_050)} />);

    expect(screen.getByText(/output · 20050 chars/u)).toBeDefined();
    expect(codeLine()).toHaveLength(20_002);
  });
});
