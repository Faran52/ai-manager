import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ChevronDown, SlidersHorizontal } from 'lucide-react';

import { agentOptions } from '@config/agents';

import {
  Menu,
  MenuCheckboxItem,
  MenuLabel,
  MenuSeparator,
} from '@ui/index';

import type { AgentId } from '@config/agents';
import type { FC } from 'react';

export interface AgentFilterBarProps {
  readonly active: readonly AgentId[];
  readonly available: readonly AgentId[];
  readonly counts: ReadonlyMap<AgentId, number>;
  readonly onChange: (agents: readonly AgentId[]) => void;
}

const projectLabel = (count: number): string => {
  return count === 1 ? 'project' : 'projects';
};

export const AgentFilterBar: FC<AgentFilterBarProps> = ({
  active,
  available,
  counts,
  onChange,
}) => {
  const { t } = useTranslation('sidebar');
  const [open, setOpen] = useState(false);
  const allSelected = active.length === 0;
  const summary = allSelected
    ? t('allAgents')
    : active.map((agent) => {
        return agentOptions.find((option) => {
          return option.id === agent;
        })?.label;
      }).filter((label) => {
        return label != null;
      }).join(', ');
  const totalCount = available.reduce((total, agent) => {
    return total + (counts.get(agent) ?? 0);
  }, 0);
  const selectedCount = available.reduce((total, agent) => {
    return allSelected || active.includes(agent)
      ? total + (counts.get(agent) ?? 0)
      : total;
  }, 0);
  const triggerLabel = `Filter agents: ${summary}, ${String(selectedCount)} ${projectLabel(selectedCount)}`;

  /*
   * Only agents this list can actually offer. An agent with nothing recorded
   * used to sit here greyed out, and a row that cannot be chosen is absent
   * rather than disabled.
   */
  const offered = agentOptions.filter((agent) => {
    return available.includes(agent.id);
  });
  const groups = [
    {
      label: t('popularAgents'),
      options: offered.filter((agent) => {
        return agent.popular === true;
      }),
    },
    {
      label: t('moreSupported'),
      options: offered.filter((agent) => {
        return agent.popular !== true;
      }),
    },
  ].filter((group) => {
    return group.options.length > 0;
  });

  const toggleAgent = (agent: AgentId): void => {
    if (allSelected) {
      onChange([agent]);

      return;
    }

    const next = active.includes(agent)
      ? active.filter((item) => {
          return item !== agent;
        })
      : agentOptions.map((option) => {
          return option.id;
        }).filter((item) => {
          return active.includes(item) || item === agent;
        });

    onChange(next);
  };

  return (
    <div className="shrink-0" data-agent-filter>
      <Menu
        align="start"
        label={t('agentFilters')}
        open={open}
        onOpenChange={setOpen}
        trigger={(
          <button
            type="button"
            aria-label={triggerLabel}
            className="sidebar-filter-trigger"
          >
            <SlidersHorizontal className="size-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{summary}</span>
            <span className="sidebar-filter-count">{selectedCount}</span>
            <ChevronDown className="size-3.5 shrink-0" data-open={open} />
          </button>
        )}
      >
        <div className="max-h-72 overflow-y-auto">
          <MenuCheckboxItem
            checked={allSelected}
            hint={totalCount}
            onChange={() => {
              onChange([]);
            }}
          >
            {t('allAgents')}
          </MenuCheckboxItem>
          {groups.map((group) => {
            return (
              <div key={group.label}>
                <MenuSeparator />
                <MenuLabel>{group.label}</MenuLabel>
                {group.options.map((agent) => {
                  return (
                    <MenuCheckboxItem
                      key={agent.id}
                      checked={!allSelected && active.includes(agent.id)}
                      hint={counts.get(agent.id) ?? 0}
                      onChange={() => {
                        toggleAgent(agent.id);
                      }}
                    >
                      {agent.label}
                    </MenuCheckboxItem>
                  );
                })}
              </div>
            );
          })}
        </div>
      </Menu>
    </div>
  );
};
