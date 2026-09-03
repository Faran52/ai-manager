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

import type { InstalledPlugin, PluginCostAttribution } from '@services/agents/agentsService';

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

// The name cell can also carry an unknown-marketplace note, and textContent
// would run the two together.
const rowNames = (): readonly string[] => {
  return within(screen.getByRole('table')).getAllByRole('row').slice(1).map((row) => {
    return row.children[0]?.firstElementChild?.textContent ?? '';
  });
};

// The table reads its figures on mount, so every case has to answer that call.
const stubCosts = (costs: readonly PluginCostAttribution[]): void => {
  vi.stubGlobal('fetch', vi.fn(() => {
    return Promise.resolve(new Response(JSON.stringify({ costs }), { status: 200 }));
  }));
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test('shows the scope and version each plugin came from', async () => {
  stubCosts([]);
  render(
    <PluginInventory
      plugins={[plugin({ scope: 'project' })]}
      projectPath={PROJECT}
      onToggle={noToggle}
    />,
  );

  expect(await screen.findByRole('table')).toBeDefined();
  expect(screen.getByText('project')).toBeDefined();
  expect(screen.getByText('1.0.0')).toBeDefined();
});

test('exposes each plugin state as a labelled switch', async () => {
  stubCosts([]);
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

  expect(await screen.findByRole('table')).toBeDefined();
  expect(screen.getByRole('switch', { name: 'review' }).getAttribute('aria-checked')).toBe('true');
  expect(screen.getByRole('switch', { name: 'sleeping' }).getAttribute('aria-checked'))
    .toBe('false');
});

test('names an unknown marketplace under the plugin and leaves a known one out', async () => {
  stubCosts([]);
  render(
    <PluginInventory
      plugins={[
        plugin({
          id: 'stray@somewhere',
          marketplace: 'somewhere',
          knownMarketplace: false,
        }),
        plugin(),
      ]}
      projectPath={PROJECT}
      onToggle={noToggle}
    />,
  );

  expect(await screen.findByRole('table')).toBeDefined();
  expect(screen.getByText('somewhere ?')).toBeDefined();
  expect(screen.queryByText('official')).toBeNull();
});

test('leaves a placeholder when the version was never recorded', async () => {
  stubCosts([]);
  render(
    <PluginInventory
      plugins={[plugin({ version: 'unknown' })]}
      projectPath={PROJECT}
      onToggle={noToggle}
    />,
  );

  expect(await screen.findByRole('table')).toBeDefined();
  expect(screen.queryByText('unknown')).toBeNull();
});

test('shortens a commit id standing in for a version', async () => {
  stubCosts([]);
  render(
    <PluginInventory
      plugins={[plugin({ version: '0120fb83da5d' })]}
      projectPath={PROJECT}
      onToggle={noToggle}
    />,
  );

  expect(await screen.findByRole('table')).toBeDefined();
  expect(screen.getByText('0120fb8')).toBeDefined();
  expect(screen.queryByText('0120fb83da5d')).toBeNull();
});

test('orders disabled first, then unknown marketplaces, then the healthy rest', async () => {
  stubCosts([]);
  render(
    <PluginInventory
      plugins={[
        plugin({ id: 'healthy@official' }),
        plugin({
          id: 'stray@somewhere',
          marketplace: 'somewhere',
          knownMarketplace: false,
        }),
        plugin({
          id: 'sleeping@official',
          enabled: false,
        }),
      ]}
      projectPath={PROJECT}
      onToggle={noToggle}
    />,
  );

  expect(await screen.findByRole('table')).toBeDefined();
  expect(rowNames()).toEqual(['sleeping', 'stray', 'healthy']);
});

test('keeps the head of a long inventory in view while its rows scroll', async () => {
  stubCosts([]);

  const many = Array.from({ length: 40 }, (_, index) => {
    return plugin({ id: `plugin-${String(index).padStart(2, '0')}@official` });
  });

  render(<PluginInventory plugins={many} projectPath={PROJECT} onToggle={noToggle} />);

  expect(await screen.findByRole('table')).toBeDefined();
  expect(rowNames()).toHaveLength(40);
  // The dialog body is the scroller, so the head sticks to that instead of the
  // table sitting in a second nested scroll box of its own.
  expect(screen.getAllByRole('columnheader')[0]?.className).toContain('sticky');
});

test('says none when no plugins are installed', () => {
  stubCosts([]);
  render(<PluginInventory plugins={[]} projectPath={PROJECT} onToggle={noToggle} />);

  expect(screen.getByText('None')).toBeDefined();
  expect(screen.queryByRole('table')).toBeNull();
});

test('waits on a spinner rather than showing a table of placeholders', () => {
  vi.stubGlobal('fetch', vi.fn(() => {
    return new Promise(() => {
      // Never settles, so the table stays in its loading state.
    });
  }));

  render(
    <PluginInventory
      plugins={[plugin()]}
      projectPath={PROJECT}
      onToggle={noToggle}
    />,
  );

  expect(screen.getByRole('status')).toBeDefined();
  expect(screen.queryByRole('table')).toBeNull();
});

test('prices always-on context by the thousand turns', async () => {
  stubCosts([{
    plugin: 'review@official',
    alwaysOnTokens: 449,
    onInvokeTokens: 2500,
    estimatedCostUsd: 0.00028,
  }]);

  render(
    <PluginInventory
      plugins={[plugin()]}
      projectPath={PROJECT}
      onToggle={noToggle}
    />,
  );

  expect(await screen.findByText('449')).toBeDefined();
  expect(screen.getByText('2,500')).toBeDefined();
  expect(screen.getByText('$0.28')).toBeDefined();
});

test('claims no cost when the project has no usage to price against', async () => {
  stubCosts([{
    plugin: 'review@official',
    alwaysOnTokens: 12,
    onInvokeTokens: 0,
    estimatedCostUsd: 0,
  }]);

  render(
    <PluginInventory
      plugins={[plugin()]}
      projectPath={PROJECT}
      onToggle={noToggle}
    />,
  );

  expect(await screen.findByText('12')).toBeDefined();
  // A plugin that never runs and costs nothing shows a placeholder in both columns.
  expect(screen.getAllByText('·')).toHaveLength(2);
  expect(screen.queryByText(/\$\d/u)).toBeNull();
});

test('reports when no cost can be attributed', async () => {
  stubCosts([]);
  render(
    <PluginInventory
      plugins={[plugin()]}
      projectPath={PROJECT}
      onToggle={noToggle}
    />,
  );

  expect(await screen.findByText('No enabled plugins to attribute cost to.')).toBeDefined();
});

test('toggles a plugin through the provided handler', async () => {
  stubCosts([]);

  const onToggle = vi.fn(() => {
    return Promise.resolve();
  });

  render(
    <PluginInventory
      plugins={[plugin()]}
      projectPath={PROJECT}
      onToggle={onToggle}
    />,
  );

  await userEvent.click(await screen.findByRole('switch', { name: 'review' }));

  expect(onToggle).toHaveBeenCalledTimes(1);
});

test('shows a failure from the toggle handler', async () => {
  stubCosts([]);

  const onToggle = vi.fn(() => {
    return Promise.reject(new Error('the cli refused'));
  });

  render(
    <PluginInventory
      plugins={[plugin()]}
      projectPath={PROJECT}
      onToggle={onToggle}
    />,
  );

  await userEvent.click(await screen.findByRole('switch', { name: 'review' }));

  expect(await screen.findByText('the cli refused')).toBeDefined();
});

test('reports a failed cost read', async () => {
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

  expect(await screen.findByText('plugin cost attribution unreachable')).toBeDefined();
});

test('drops a cost read that lands after the table has gone', async () => {
  let release = (): void => {
    // Replaced by the deferred resolver below.
  };
  const pending = new Promise<Response>((resolve) => {
    release = () => {
      resolve(new Response(JSON.stringify({ costs: [] }), { status: 200 }));
    };
  });

  vi.stubGlobal('fetch', vi.fn(() => {
    return pending;
  }));

  const { unmount } = render(
    <PluginInventory
      plugins={[plugin()]}
      projectPath={PROJECT}
      onToggle={noToggle}
    />,
  );

  unmount();
  release();

  await expect(pending).resolves.toBeDefined();
  expect(screen.queryByRole('table')).toBeNull();
});

test('drops a failed cost read that lands after the table has gone', async () => {
  let refuse = (): void => {
    // Replaced by the deferred rejecter below.
  };
  const pending = new Promise<Response>((_resolve, reject) => {
    refuse = () => {
      reject(new Error('offline'));
    };
  });

  vi.stubGlobal('fetch', vi.fn(() => {
    return pending;
  }));

  const { unmount } = render(
    <PluginInventory
      plugins={[plugin()]}
      projectPath={PROJECT}
      onToggle={noToggle}
    />,
  );

  unmount();
  refuse();

  await expect(pending).rejects.toThrow('offline');
  expect(screen.queryByText('plugin cost attribution unreachable')).toBeNull();
});
