import {
  render,
  screen,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach,
  expect,
  test,
  vi,
} from 'vitest';

import { PluginInventory } from './PluginInventory';

import type { InstalledPlugin } from '@services/agents/agentsService';

const PROJECT = '/Users/dev/Projects/app';

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

const noToggle = (): Promise<void> => {
  return Promise.resolve();
};

const rowNames = (): readonly string[] => {
  return within(screen.getByRole('table')).getAllByRole('row').slice(1).map((row) => {
    return row.children[0]?.textContent ?? '';
  });
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

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
      projectPath={PROJECT}
      onToggle={noToggle}
    />,
  );

  expect(screen.getByText('Plugins 1/2')).toBeDefined();
  expect(rowNames()).toEqual(['sleeping', 'review']);
});

test('shows the scope, version and marketplace each plugin came from', () => {
  render(
    <PluginInventory
      plugins={[plugin({
        scope: 'project',
        version: '2.4.0',
      })]}
      projectPath={PROJECT}
      onToggle={noToggle}
    />,
  );

  expect(screen.getByText('project')).toBeDefined();
  expect(screen.getByText('2.4.0')).toBeDefined();
  expect(screen.getByText('official')).toBeDefined();
  expect(screen.getByText('on')).toBeDefined();
});

test('exposes each plugin state as a labelled switch', () => {
  render(
    <PluginInventory
      plugins={[
        plugin(),
        plugin({
          id: 'sleeping@official',
          enabled: false,
        }),
      ]}
      projectPath={PROJECT}
      onToggle={noToggle}
    />,
  );

  expect(screen.getByRole('switch', { name: 'review' }).getAttribute('aria-checked')).toBe('true');
  expect(screen.getByRole('switch', { name: 'sleeping' }).getAttribute('aria-checked')).toBe('false');
});

test('marks a plugin whose marketplace is unknown', () => {
  const orphan = plugin({
    id: 'orphan@vanished',
    marketplace: 'vanished',
    knownMarketplace: false,
  });

  render(<PluginInventory plugins={[orphan]} projectPath={PROJECT} onToggle={noToggle} />);

  expect(screen.getByText('vanished ?')).toBeDefined();
});

test('leaves a placeholder when the version was never recorded', () => {
  render(
    <PluginInventory
      plugins={[plugin({ version: 'unknown' })]}
      projectPath={PROJECT}
      onToggle={noToggle}
    />,
  );

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
      projectPath={PROJECT}
      onToggle={noToggle}
    />,
  );

  expect(rowNames()).toEqual(['dormant', 'stranger', 'alpha', 'zulu']);
});

test('lists every plugin of a long inventory inside a bounded scroller', () => {
  const many = Array.from({ length: 40 }, (_, index) => {
    return plugin({ id: `plugin-${String(index).padStart(2, '0')}@official` });
  });

  render(<PluginInventory plugins={many} projectPath={PROJECT} onToggle={noToggle} />);

  expect(screen.getByText('Plugins 40/40')).toBeDefined();
  expect(rowNames()).toHaveLength(40);
  expect(screen.getByRole('table').parentElement?.className).toContain('overflow-y-auto');
});

test('says none when no plugins are installed', () => {
  render(<PluginInventory plugins={[]} projectPath={PROJECT} onToggle={noToggle} />);

  expect(screen.getByText('Plugins 0/0')).toBeDefined();
  expect(screen.getByText('None')).toBeDefined();
  expect(screen.queryByRole('table')).toBeNull();
});

test('toggles a plugin through the provided handler', async () => {
  const user = userEvent.setup();
  let toggledId: string | undefined;
  const onToggle = (received: InstalledPlugin): Promise<void> => {
    toggledId = received.id;

    return Promise.resolve();
  };

  render(
    <PluginInventory
      plugins={[plugin()]}
      projectPath={PROJECT}
      onToggle={onToggle}
    />,
  );
  await user.click(screen.getByRole('switch', { name: 'review' }));

  expect(toggledId).toBe('review@official');
});

test('shows a failure from the toggle handler', async () => {
  const user = userEvent.setup();
  const onToggle = vi.fn(() => {
    return Promise.reject(new Error('cli refused'));
  });

  render(
    <PluginInventory
      plugins={[plugin()]}
      projectPath={PROJECT}
      onToggle={onToggle}
    />,
  );
  await user.click(screen.getByRole('switch', { name: 'review' }));

  expect(await screen.findByText('cli refused')).toBeDefined();
});

test('estimates context cost through the api', async () => {
  const user = userEvent.setup();

  vi.stubGlobal('fetch', vi.fn(() => {
    return Promise.resolve(new Response(JSON.stringify({
      costs: [{
        plugin: 'review@official',
        alwaysOnTokens: 449,
        onInvokeTokens: 2500,
        estimatedCostUsd: 0.0225,
      }],
    }), { status: 200 }));
  }));

  render(
    <PluginInventory
      plugins={[plugin()]}
      projectPath={PROJECT}
      onToggle={noToggle}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Estimate context cost' }));

  expect(await screen.findByText('449')).toBeDefined();
  expect(screen.getByText('2,500')).toBeDefined();
  expect(screen.getByText('$0.0225')).toBeDefined();
});

test('names the floor rather than rounding a small cost to nothing', async () => {
  const user = userEvent.setup();

  vi.stubGlobal('fetch', vi.fn(() => {
    return Promise.resolve(new Response(JSON.stringify({
      costs: [{
        plugin: 'review@official',
        alwaysOnTokens: 20,
        onInvokeTokens: 0,
        estimatedCostUsd: 0.0000144,
      }],
    }), { status: 200 }));
  }));

  render(
    <PluginInventory
      plugins={[plugin()]}
      projectPath={PROJECT}
      onToggle={noToggle}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Estimate context cost' }));

  expect(await screen.findByText('<$0.0001')).toBeDefined();
  expect(screen.queryByText('$0.0000')).toBeNull();
});

test('claims no cost when the project has no usage to price against', async () => {
  const user = userEvent.setup();

  vi.stubGlobal('fetch', vi.fn(() => {
    return Promise.resolve(new Response(JSON.stringify({
      costs: [{
        plugin: 'review@official',
        alwaysOnTokens: 12,
        onInvokeTokens: 30,
        estimatedCostUsd: 0,
      }],
    }), { status: 200 }));
  }));

  render(
    <PluginInventory
      plugins={[plugin()]}
      projectPath={PROJECT}
      onToggle={noToggle}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Estimate context cost' }));

  expect(await screen.findByText('12')).toBeDefined();
  expect(screen.getByText('·')).toBeDefined();
  expect(screen.queryByText(/\$/u)).toBeNull();
});

test('reports when no cost can be attributed', async () => {
  const user = userEvent.setup();

  vi.stubGlobal('fetch', vi.fn(() => {
    return Promise.resolve(new Response(JSON.stringify({ costs: [] }), { status: 200 }));
  }));

  render(
    <PluginInventory
      plugins={[plugin()]}
      projectPath={PROJECT}
      onToggle={noToggle}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Estimate context cost' }));

  expect(await screen.findByText('No enabled plugins to attribute cost to.')).toBeDefined();
});

test('reports a failed estimate', async () => {
  const user = userEvent.setup();

  vi.stubGlobal('fetch', vi.fn(() => {
    return Promise.reject(new Error('offline'));
  }));

  render(
    <PluginInventory
      plugins={[plugin()]}
      projectPath={PROJECT}
      onToggle={noToggle}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Estimate context cost' }));

  expect(await screen.findByText('plugin cost attribution unreachable')).toBeDefined();
});
