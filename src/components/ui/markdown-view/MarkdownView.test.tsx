import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { MarkdownView } from './MarkdownView';

const codeLine = (): string | undefined => {
  return document.querySelector('[data-code-line]')?.textContent ?? undefined;
};

const reducedMotion = (matches: boolean): void => {
  vi.stubGlobal('matchMedia', () => {
    return {
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
  });
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MarkdownView', () => {
  test('parses trusted prose inline, with no card when it has no block', () => {
    reducedMotion(false);
    render(<MarkdownView text="**strong** words" trusted />);

    expect(screen.getByText('strong').tagName).toBe('STRONG');
    expect(screen.queryByRole('radio')).toBeNull();
    expect(document.querySelector('[data-markdown-view]')).toBeNull();
  });

  test('shows untrusted plain text raw with no card', () => {
    reducedMotion(false);
    render(<MarkdownView text={'build ok\nran 12 tests\nno failures'} />);

    expect(codeLine()).toContain('ran 12 tests');
    expect(screen.queryByRole('radio')).toBeNull();
    expect(document.querySelector('[data-markdown-view]')).toBeNull();
  });

  test('cards a Markdown block with a Parsed default and a slide to raw', async () => {
    reducedMotion(false);
    render(<MarkdownView text={'# Report\n\nthe body'} trusted />);

    expect(screen.getByText('Report').tagName).toBe('H1');
    expect(screen.getByRole('radio', { name: 'Parsed' })).toHaveProperty('checked', true);

    await userEvent.click(screen.getByRole('radio', { name: 'Raw' }));

    expect(codeLine()).toContain('# Report');
  });

  test('cards untrusted text once the identifier finds a block', () => {
    reducedMotion(false);
    render(<MarkdownView text={'Findings\n- one\n- two'} />);

    expect(screen.getByText('one').closest('ul')).not.toBeNull();
    expect(document.querySelector('[data-markdown-view]')).not.toBeNull();
  });

  test('drops the crossfade for a reduced-motion reader', () => {
    reducedMotion(true);
    render(<MarkdownView text={'# Report\n\nbody'} trusted />);

    expect(screen.getByText('Report').tagName).toBe('H1');
  });
});
