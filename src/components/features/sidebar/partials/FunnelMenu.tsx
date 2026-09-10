import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  CalendarRange,
  ListFilter,
  Users,
} from 'lucide-react';

import { agentOptions } from '@config/agents';

import {
  Menu,
  MenuCheckboxItem,
  MenuLabel,
  MenuRadioGroup,
  MenuSeparator,
  MenuSub,
} from '@ui/index';

import { DATE_FILTER_LABEL, DATE_FILTERS } from '../utils/dateFilterUtils';

import type { AgentId } from '@config/agents';
import type { FC } from 'react';
import type { DateFilter } from '../utils/dateFilterUtils';

export type FunnelOrder = 'newest' | 'oldest';

export interface FunnelAgents {
  // How many rows each agent holds; the offered list is drawn from its keys.
  readonly counts: ReadonlyMap<AgentId, number>;
  // Empty means every agent, so clearing widens the list rather than emptying it.
  readonly active: readonly AgentId[];
  readonly onToggle: (agent: AgentId) => void;
  readonly onClear: () => void;
}

export interface FunnelMenuProps {
  // Names the trigger and the menu; the two columns each carry their own.
  readonly label: string;
  readonly align?: 'start' | 'end';
  // Left out for the session list: a project's sessions are all one agent, so
  // there is nothing there to narrow by agent and the submenu does not appear.
  readonly agents?: FunnelAgents | undefined;
  readonly dateFilter: DateFilter;
  readonly onDateFilterChange: (filter: DateFilter) => void;
  readonly order: FunnelOrder;
  readonly onOrderChange: (order: FunnelOrder) => void;
}

/**
 * The one funnel both sidebar columns hang off: an agent set and a date window
 * to narrow by, and which end of the history to read from. The projects column
 * passes `agents` and gets the Agents submenu; the session list does not.
 */
export const FunnelMenu: FC<FunnelMenuProps> = ({
  label,
  align = 'end',
  agents,
  dateFilter,
  onDateFilterChange,
  order,
  onOrderChange,
}) => {
  const { t } = useTranslation('sidebar');
  const [open, setOpen] = useState(false);
  const active = agents?.active ?? [];
  const allAgents = active.length === 0;
  const narrowed = !allAgents || dateFilter !== 'all';

  /*
   * The whole supported set, so the menu reads as what the app knows about. An
   * agent with no project in this column is offered disabled rather than hidden,
   * and the ones that can be filtered to sort ahead of the ones that cannot.
   */
  const offered = agents == null
    ? []
    : agentOptions
        .map((option) => {
          return {
            option,
            count: agents.counts.get(option.id) ?? 0,
          };
        })
        .sort((left, right) => {
          return Number(right.count > 0) - Number(left.count > 0);
        });
  const totalCount = offered.reduce((total, entry) => {
    return total + entry.count;
  }, 0);
  // Both groups are always populated: offered is the whole supported set.
  const agentGroups = [
    {
      label: t('popularAgents'),
      options: offered.filter((entry) => {
        return entry.option.popular === true;
      }),
    },
    {
      label: t('moreSupported'),
      options: offered.filter((entry) => {
        return entry.option.popular !== true;
      }),
    },
  ];

  return (
    <div className="shrink-0" data-funnel>
      <Menu
        align={align}
        label={label}
        open={open}
        onOpenChange={setOpen}
        trigger={(
          <button
            type="button"
            aria-label={label}
            aria-expanded={open}
            data-active={narrowed}
            className="sidebar-funnel-trigger"
          >
            <ListFilter className="size-3.5" />
          </button>
        )}
      >
        <MenuLabel>{t('filterBy')}</MenuLabel>
        {agents != null && (
          <MenuSub
            label={t('agents')}
            icon={<Users className="size-3.5" />}
            value={allAgents ? t('allAgents') : t('agentCount', { count: active.length })}
          >
            <div className="max-h-72 overflow-y-auto">
              <MenuCheckboxItem checked={allAgents} hint={totalCount} onChange={agents.onClear}>
                {t('allAgents')}
              </MenuCheckboxItem>
              {agentGroups.map((group) => {
                return (
                  <div key={group.label}>
                    <MenuSeparator />
                    <MenuLabel>{group.label}</MenuLabel>
                    {group.options.map(({ option, count }) => {
                      return (
                        <MenuCheckboxItem
                          key={option.id}
                          checked={allAgents || active.includes(option.id)}
                          disabled={count === 0}
                          hint={count}
                          onChange={() => {
                            agents.onToggle(option.id);
                          }}
                        >
                          <span className="inline-flex items-center gap-2">
                            <span
                              data-agent={option.id}
                              className="
                                agent-dot size-1.5 shrink-0 rounded-full
                              "
                              aria-hidden
                            />
                            {option.label}
                          </span>
                        </MenuCheckboxItem>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </MenuSub>
        )}
        <MenuSub
          label={t('dateFilter')}
          icon={<CalendarRange className="size-3.5" />}
          value={t(DATE_FILTER_LABEL[dateFilter])}
        >
          <MenuRadioGroup
            value={dateFilter}
            onChange={(value) => {
              onDateFilterChange(value as DateFilter);
            }}
            options={DATE_FILTERS.map((filter) => {
              return {
                value: filter,
                label: t(DATE_FILTER_LABEL[filter]),
              };
            })}
          />
        </MenuSub>
        <MenuSeparator />
        <MenuLabel>{t('orderBy')}</MenuLabel>
        <MenuRadioGroup
          value={order}
          onChange={(value) => {
            onOrderChange(value as FunnelOrder);
          }}
          options={[
            {
              value: 'newest',
              label: t('newestFirst'),
            },
            {
              value: 'oldest',
              label: t('oldestFirst'),
            },
          ]}
        />
      </Menu>
    </div>
  );
};
