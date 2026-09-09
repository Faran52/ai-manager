import {
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach,
  expect,
  test,
  vi,
} from 'vitest';

import { CopyTranscriptButton } from './CopyTranscriptButton';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('copies the transcript as markdown and confirms it', async () => {
  const writeText = vi.fn<(text: string) => Promise<void>>();
  vi.stubGlobal('navigator', { clipboard: { writeText } });

  render(<CopyTranscriptButton entries={[]} project="project" title="My Title" />);

  expect(screen.queryByRole('status')).toBeNull();

  await userEvent.click(screen.getByRole('button', { name: 'Copy markdown' }));

  await waitFor(() => {
    expect(writeText).toHaveBeenCalledOnce();
  });
  expect(String(writeText.mock.calls.at(0)?.at(0))).toContain('# My Title');
  expect(await screen.findByRole('button', { name: 'Copied markdown' })).toBeDefined();
  expect(screen.getByRole('status').textContent).toBe('Copied!');
});
