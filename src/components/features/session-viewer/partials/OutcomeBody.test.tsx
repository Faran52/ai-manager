import { render, screen } from '@testing-library/react';

import { OutcomeBody } from './OutcomeBody';

import type { ToolOutcome } from '@services/history/historyService';

test('renders outcome text, errors and images while allowing an empty result', () => {
  const { rerender } = render(
    <OutcomeBody outcome={{
      toolUseId: 't',
      status: 'error',
      text: 'output',
      stderr: 'failure',
      images: [{ url: 'https://example.com/image.png' }],
    }}
    />,
  );

  expect(screen.getByText('output')).toBeDefined();
  expect(screen.getByText('failure')).toBeDefined();
  expect(screen.getByRole('img')).toBeDefined();

  rerender(
    <OutcomeBody outcome={{
      toolUseId: 't',
      status: 'ok',
      images: [],
    }}
    />,
  );
  expect(document.body.textContent).toBe('');
});

test('labels the output by the tool family that produced it', () => {
  const outcome: ToolOutcome = {
    toolUseId: 't',
    status: 'ok',
    text: 'body https://example.com/a',
    images: [],
  };

  const { rerender } = render(<OutcomeBody outcome={outcome} kind="mcp" />);

  expect(screen.queryByRole('link')).toBeNull();

  rerender(<OutcomeBody outcome={outcome} kind="web-search" />);
  expect(screen.getByRole('link')).toBeDefined();

  rerender(<OutcomeBody outcome={outcome} kind="web-fetch" />);
  expect(screen.getByRole('link')).toBeDefined();
});
