import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  ChevronDown,
  Filter,
  RotateCcw,
  X,
} from 'lucide-react';

import { cn } from '@utils/cnUtils';

import { MenuCheckboxItem, PopupMenu } from '@ui/index';

import {
  defaultMessageFilters,
  hasActiveMessageFilters,
  toggleMessageFilter,
} from '../messageFilters';

import type { FC } from 'react';
import type { MessageFilterKey, MessageFilters } from '../messageFilters';

export interface MessageFilterToolbarProps {
  readonly filters: MessageFilters;
  readonly total: number;
  readonly visible: number;
  readonly onChange: (filters: MessageFilters) => void;
}

interface FilterOption {
  readonly key: MessageFilterKey;
  readonly label: string;
  readonly menuLabel: string;
  readonly active: boolean;
}

export const MessageFilterToolbar: FC<MessageFilterToolbarProps> = ({
  filters,
  total,
  visible,
  onChange,
}) => {
  const { t } = useTranslation('session');
  const [open, setOpen] = useState(false);
  const options: readonly FilterOption[] = [
    {
      key: 'human',
      label: t('user'),
      menuLabel: t('userMessages'),
      active: filters.roles.human,
    },
    {
      key: 'ai',
      label: t('assistant'),
      menuLabel: t('assistantMessages'),
      active: filters.roles.ai,
    },
    {
      key: 'text',
      label: t('text'),
      menuLabel: t('textMessages'),
      active: filters.content.text,
    },
    {
      key: 'thinking',
      label: t('thinking'),
      menuLabel: t('thinking'),
      active: filters.content.thinking,
    },
    {
      key: 'tools',
      label: t('tools'),
      menuLabel: t('toolActivity'),
      active: filters.content.tools,
    },
    {
      key: 'commands',
      label: t('commands'),
      menuLabel: t('commands'),
      active: filters.content.commands,
    },
  ];
  const active = hasActiveMessageFilters(filters);
  const hiddenOptions = options.filter((option) => {
    return !option.active;
  });
  const countLabel = active
    ? t('itemsShown', {
        visible,
        total,
      })
    : t('itemsLoaded', { count: total });

  const toggle = (key: MessageFilterKey): void => {
    onChange(toggleMessageFilter(filters, key));
  };

  return (
    <div className={cn(
      `
        flex min-h-10 shrink-0 flex-wrap items-center gap-1.5 overflow-visible
        border-b border-border px-3 py-1.5
      `,
      active && 'bg-primary/10',
    )}
    >
      <div className="relative shrink-0">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={t('filterMessages')}
          onClick={() => {
            setOpen((current) => {
              return !current;
            });
          }}
          className={cn('toolbar-button', active && 'bg-primary/10 text-primary')}
        >
          <Filter className="size-3.5" />
          {t('filterMessages')}
          <ChevronDown className="size-3" data-open={open} />
        </button>
        <PopupMenu
          open={open}
          onClose={() => {
            setOpen(false);
          }}
          label={t('messageFilters')}
          align="left"
        >
          <p className="
            px-2 py-1 text-[10px] font-semibold tracking-wider
            text-muted-foreground uppercase
          "
          >
            {t('participants')}
          </p>
          {options.slice(0, 2).map((option) => {
            return (
              <MenuCheckboxItem
                key={option.key}
                checked={option.active}
                onClick={() => {
                  toggle(option.key);
                }}
              >
                {option.menuLabel}
              </MenuCheckboxItem>
            );
          })}
          <div className="my-1 border-t border-border" />
          <p className="
            px-2 py-1 text-[10px] font-semibold tracking-wider
            text-muted-foreground uppercase
          "
          >
            {t('contentHeading')}
          </p>
          {options.slice(2).map((option) => {
            return (
              <MenuCheckboxItem
                key={option.key}
                checked={option.active}
                onClick={() => {
                  toggle(option.key);
                }}
              >
                {option.menuLabel}
              </MenuCheckboxItem>
            );
          })}
        </PopupMenu>
      </div>
      <span className="
        shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums
      "
      >
        {countLabel}
      </span>
      {hiddenOptions.map((option) => {
        return (
          <button
            key={option.key}
            type="button"
            aria-label={t('showFilter', { name: option.menuLabel })}
            onClick={() => {
              toggle(option.key);
            }}
            className="
              inline-flex shrink-0 items-center gap-1 rounded-md bg-primary/10
              px-1.5 py-1 text-[11px] font-medium text-primary
              hover:bg-primary/15
            "
          >
            {t('filterHidden', { name: option.label })}
            <X className="size-3" />
          </button>
        );
      })}
      {active && (
        <button
          type="button"
          aria-label={t('resetConversationFilters')}
          title={t('resetFilters')}
          onClick={() => {
            onChange(defaultMessageFilters());
          }}
          className="
            shrink-0 rounded-md p-1 text-muted-foreground
            hover:bg-accent hover:text-foreground
          "
        >
          <RotateCcw className="size-3.5" />
        </button>
      )}
    </div>
  );
};
