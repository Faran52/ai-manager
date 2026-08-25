import { Blocks } from 'lucide-react';

import { cn } from '@utils/cnUtils';

import type { InstalledPlugin } from '@services/agents/agentsService';
import type { FC } from 'react';

export interface PluginInventoryProps {
  readonly plugins: readonly InstalledPlugin[];
}

const CELL = 'truncate py-1 pr-4 text-left align-middle';
const HEAD = cn(CELL, `
  sticky top-0 bg-card text-[10px] font-medium tracking-wider
  text-muted-foreground uppercase
`);

const rank = (plugin: InstalledPlugin): number => {
  if (!plugin.enabled) {
    return 0;
  }

  return plugin.knownMarketplace ? 2 : 1;
};

// Disabled first, then unknown marketplaces, then the healthy rest alphabetically.
const ordered = (plugins: readonly InstalledPlugin[]): readonly InstalledPlugin[] => {
  return [...plugins].sort((left, right) => {
    return rank(left) - rank(right) || left.id.localeCompare(right.id);
  });
};

export const PluginInventory: FC<PluginInventoryProps> = ({ plugins }) => {
  const active = plugins.filter((plugin) => {
    return plugin.enabled;
  });

  return (
    <section className="mt-2 border-t border-border pt-2">
      <h5 className="
        flex items-center gap-1.5 pb-1 text-xs text-muted-foreground
      "
      >
        <Blocks className="size-3" />
        {`Plugins ${String(active.length)}/${String(plugins.length)}`}
      </h5>
      {plugins.length === 0
        ? <p className="text-xs text-muted-foreground">None</p>
        : (
            <div className="
              max-h-56 max-w-3xl overflow-y-auto rounded-sm border
              border-border/60
            "
            >
              <table className="
                w-full table-fixed border-collapse font-mono text-[11px]
              "
              >
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className={cn(HEAD, 'w-[30%] pl-2')}>Plugin</th>
                    <th scope="col" className={cn(HEAD, 'w-[30%]')}>Marketplace</th>
                    <th scope="col" className={cn(HEAD, 'w-[14%]')}>Scope</th>
                    <th scope="col" className={cn(HEAD, 'w-[16%]')}>Version</th>
                    <th scope="col" className={cn(HEAD, 'w-[10%]')}>State</th>
                  </tr>
                </thead>
                <tbody>
                  {ordered(plugins).map((plugin) => {
                    const version = plugin.version === 'unknown' ? '' : plugin.version;

                    return (
                      <tr
                        key={plugin.id}
                        className={cn('hover:bg-muted-foreground/5', !plugin.enabled && `
                          text-muted-foreground
                        `)}
                      >
                        <td className={cn(CELL, 'pl-2', !plugin.enabled && `
                          line-through
                        `)}
                        >
                          {plugin.id.split('@')[0]}
                        </td>
                        <td className={cn(CELL, 'text-muted-foreground')}>
                          {plugin.knownMarketplace
                            ? plugin.marketplace
                            : <span className="text-warn">{`${plugin.marketplace} ?`}</span>}
                        </td>
                        <td className={cn(CELL, 'text-muted-foreground')}>{plugin.scope}</td>
                        <td className={cn(CELL, 'text-muted-foreground/70')}>
                          {version.length > 0 ? version : '·'}
                        </td>
                        <td className={cn(CELL, plugin.enabled
                          ? 'text-ok'
                          : 'text-muted-foreground')}
                        >
                          {plugin.enabled ? 'on' : 'off'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
    </section>
  );
};
