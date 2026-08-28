import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Check,
  ChevronDown,
  SlidersHorizontal,
} from 'lucide-react';

import { agentOptions } from '@config/agents';

import { PopupMenu } from '@ui/index';

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
  const groups = [
    {
      label: t('popularAgents'),
      options: agentOptions.filter((agent) => {
        return agent.popular === true;
      }),
    },
    {
      label: t('moreSupported'),
      options: agentOptions.filter((agent) => {
        return agent.popular !== true;
      }),
    },
  ];

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
    <div className="relative shrink-0" data-agent-filter>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={triggerLabel}
        onClick={() => {
          setOpen((current) => {
            return !current;
          });
        }}
        className="sidebar-filter-trigger"
      >
        <SlidersHorizontal className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{summary}</span>
        <span className="sidebar-filter-count">{selectedCount}</span>
        <ChevronDown className="size-3.5 shrink-0" data-open={open} />
      </button>
      <PopupMenu
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        label={t('agentFilters')}
      >
        <div className="max-h-72 w-full overflow-y-auto p-0.5">
          <button
            type="button"
            aria-label={t('allAgents')}
            aria-pressed={allSelected}
            data-selected={allSelected}
            onClick={() => {
              onChange([]);
            }}
            className="agent-filter-option"
          >
            <Check className="agent-filter-check" />
            <span className="min-w-0 flex-1 truncate">{t('allAgents')}</span>
            <span className="sidebar-filter-count">{totalCount}</span>
          </button>
          {groups.map((group) => {
            return (
              <div key={group.label}>
                <p className="
                  px-2 pt-2 pb-1 text-[10px] font-semibold tracking-wider
                  text-muted-foreground uppercase
                "
                >
                  {group.label}
                </p>
                {group.options.map((agent) => {
                  const enabled = available.includes(agent.id);
                  const selected = !allSelected && active.includes(agent.id);

                  return (
                    <button
                      type="button"
                      key={agent.id}
                      aria-label={agent.label}
                      aria-pressed={selected}
                      data-selected={selected}
                      disabled={!enabled}
                      onClick={() => {
                        toggleAgent(agent.id);
                      }}
                      className="agent-filter-option"
                    >
                      <Check className="agent-filter-check" />
                      <span className="min-w-0 flex-1 truncate">{agent.label}</span>
                      <span className="sidebar-filter-count">{counts.get(agent.id) ?? 0}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </PopupMenu>
    </div>
  );
};
