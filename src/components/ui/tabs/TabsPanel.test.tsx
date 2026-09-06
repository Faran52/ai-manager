import { render, screen } from '@testing-library/react';
import {
  describe,
  expect,
  test,
} from 'vitest';

import { Tabs } from './Tabs';
import { TabsPanel } from './TabsPanel';

const ITEMS = [
  {
    id: 'one',
    label: 'One',
  },
  {
    id: 'two',
    label: 'Two',
  },
];

const host = (value: string): ReturnType<typeof render> => {
  return render(
    <Tabs
      items={ITEMS}
      label="Panels"
      value={value}
      onChange={() => {
        return undefined;
      }}
    >
      <TabsPanel value="one">first body</TabsPanel>
      <TabsPanel value="two">second body</TabsPanel>
    </Tabs>,
  );
};

describe('TabsPanel', () => {
  test('shows the body belonging to the selected tab', () => {
    host('one');

    expect(screen.getByRole('tabpanel').textContent).toBe('first body');
  });

  test('swaps bodies when the selection changes', () => {
    host('two');

    expect(screen.getByRole('tabpanel').textContent).toBe('second body');
    expect(screen.queryByText('first body')).toBeNull();
  });

  test('names its panel with the tab that controls it', () => {
    host('one');

    expect(screen.getByRole('tabpanel', { name: 'One' })).toBeDefined();
  });
});
