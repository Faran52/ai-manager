import {
  render,
  screen,
  within,
} from '@testing-library/react';
import { expect, test } from 'vitest';

import { PluginInventory } from './PluginInventory';

import type { InstalledPlugin } from '@services/agents/agentsService';

const plugin = (overrides: Partial<InstalledPlugin> = {}): InstalledPlugin => {
  return {
    id: 'review@official',
    marketplace: 'official',
    scope: 'user',
    enabled: true,
    version: '1.0.0',
    knownMarketplace: true,
    ...overrides,
  };
};

const rowNames = (): readonly string[] => {
  return within(screen.getByRole('table')).getAllByRole('row').slice(1).map((row) => {
    return row.children[0]?.textContent ?? '';
  });
};

test('counts how many of the installed plugins are switched on', () => {
  render(
    <PluginInventory
      plugins={[
        plugin(),
        plugin({
          id: 'sleeping@official',
          enabled: false,
        }),
      ]}
    />,
  );

  expect(screen.getByText('Plugins 1/2')).toBeDefined();
  expect(rowNames()).toEqual(['sleeping', 'review']);
});

test('shows the scope, version and marketplace each plugin came from', () => {
  render(
    <PluginInventory plugins={[plugin({
      scope: 'project',
      version: '2.4.0',
    })]}
    />,
  );

  expect(screen.getByText('project')).toBeDefined();
  expect(screen.getByText('2.4.0')).toBeDefined();
  expect(screen.getByText('official')).toBeDefined();
  expect(screen.getByText('on')).toBeDefined();
});

test('marks a plugin whose marketplace is unknown', () => {
  const orphan = plugin({
    id: 'orphan@vanished',
    marketplace: 'vanished',
    knownMarketplace: false,
  });

  render(<PluginInventory plugins={[orphan]} />);

  expect(screen.getByText('vanished ?')).toBeDefined();
});

test('leaves a placeholder when the version was never recorded', () => {
  render(<PluginInventory plugins={[plugin({ version: 'unknown' })]} />);

  expect(screen.getByText('·')).toBeDefined();
  expect(screen.queryByText('unknown')).toBeNull();
});

test('orders disabled first, then unknown marketplaces, then the healthy rest', () => {
  render(
    <PluginInventory
      plugins={[
        plugin({ id: 'zulu@official' }),
        plugin({ id: 'alpha@official' }),
        plugin({
          id: 'stranger@nowhere',
          marketplace: 'nowhere',
          knownMarketplace: false,
        }),
        plugin({
          id: 'dormant@official',
          enabled: false,
        }),
      ]}
    />,
  );

  expect(rowNames()).toEqual(['dormant', 'stranger', 'alpha', 'zulu']);
});

test('lists every plugin of a long inventory inside a bounded scroller', () => {
  const many = Array.from({ length: 40 }, (_, index) => {
    return plugin({ id: `plugin-${String(index).padStart(2, '0')}@official` });
  });

  render(<PluginInventory plugins={many} />);

  expect(screen.getByText('Plugins 40/40')).toBeDefined();
  expect(rowNames()).toHaveLength(40);
  expect(screen.getByRole('table').parentElement?.className).toContain('overflow-y-auto');
});

test('says none when no plugins are installed', () => {
  render(<PluginInventory plugins={[]} />);

  expect(screen.getByText('Plugins 0/0')).toBeDefined();
  expect(screen.getByText('None')).toBeDefined();
  expect(screen.queryByRole('table')).toBeNull();
});
