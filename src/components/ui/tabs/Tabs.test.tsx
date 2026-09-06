import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { Tabs } from './Tabs';
import { TabsPanel } from './TabsPanel';

const ITEMS = [
  {
    id: 'transcript',
    label: 'Transcript',
  },
  {
    id: 'navigator',
    label: 'Navigator',
  },
  {
    id: 'edits',
    label: 'File edits',
  },
];

describe('Tabs', () => {
  test('marks the selected tab and shows only its panel', () => {
    render(
      <Tabs items={ITEMS} label="Session panels" onChange={vi.fn()} value="navigator">
        <TabsPanel value="transcript">the transcript</TabsPanel>
        <TabsPanel value="navigator">the navigator</TabsPanel>
      </Tabs>,
    );

    expect(screen.getByRole('tab', { selected: true }).textContent).toBe('Navigator');
    expect(screen.getByText('the navigator')).toBeDefined();
    expect(screen.queryByText('the transcript')).toBeNull();
  });

  test('reports the tab a click chose', async () => {
    const onChange = vi.fn();

    render(
      <Tabs items={ITEMS} label="Session panels" onChange={onChange} value="transcript" />,
    );
    await userEvent.click(screen.getByRole('tab', { name: 'File edits' }));

    expect(onChange).toHaveBeenCalledWith('edits');
  });

  test('moves between tabs with an arrow key', async () => {
    const onChange = vi.fn();

    render(
      <Tabs items={ITEMS} label="Session panels" onChange={onChange} value="transcript" />,
    );
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');

    expect(onChange).toHaveBeenCalledWith('navigator');
  });

  test('keeps the label as the accessible name when only icons show', () => {
    render(
      <Tabs
        iconOnly
        items={ITEMS}
        label="Session panels"
        onChange={vi.fn()}
        value="transcript"
      />,
    );

    expect(screen.getByRole('tab', { name: 'Navigator' })).toBeDefined();
  });
});
