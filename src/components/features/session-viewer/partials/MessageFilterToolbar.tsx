import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  ChevronDown,
  Filter,
  RotateCcw,
  X,
} from 'lucide-react';

import { cn } from '@utils/cnUtils';

import {
  Menu,
  MenuCheckboxItem,
  MenuLabel,
  MenuSeparator,
} from '@ui/index';

import {
  defaultMessageFilters,
  hasActiveMessageFilters,
  toggleMessageFilter,
} from '../utils/messageFilterUtils';

import type { FC } from 'react';
import type { MessageFilterKey, MessageFilters } from '../utils/messageFilterUtils';

export interface MessageFilterToolbarProps {
  readonly filters: MessageFilters;
  readonly total: number;
  readonly visible: number;
  readonly onChange: (filters: MessageFilters) => void;
  readonly onDismiss: () => void;
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
  onDismiss,
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
      <div className="shrink-0">
        <Menu
          align="start"
          label={t('messageFilters')}
          open={open}
          onOpenChange={setOpen}
          trigger={(
            <button
              type="button"
              aria-label={t('filterMessages')}
              className={cn('toolbar-button', active && `
                bg-primary/10 text-primary
              `)}
            >
              <Filter className="size-3.5" />
              {t('filterMessages')}
              <ChevronDown className="size-3" data-open={open} />
            </button>
          )}
        >
          <MenuLabel>{t('participants')}</MenuLabel>
          {options.slice(0, 2).map((option) => {
            return (
              <MenuCheckboxItem
                key={option.key}
                checked={option.active}
                onChange={() => {
                  toggle(option.key);
                }}
              >
                {option.menuLabel}
              </MenuCheckboxItem>
            );
          })}
          <MenuSeparator />
          <MenuLabel>{t('contentHeading')}</MenuLabel>
          {options.slice(2).map((option) => {
            return (
              <MenuCheckboxItem
                key={option.key}
                checked={option.active}
                onChange={() => {
                  toggle(option.key);
                }}
              >
                {option.menuLabel}
              </MenuCheckboxItem>
            );
          })}
        </Menu>
      </div>
      <span className="
        shrink-0 font-mono text-body text-muted-foreground tabular-nums
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
              px-1.5 py-1 text-body font-medium text-primary
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
      <button
        type="button"
        aria-label={t('hideFilterBar')}
        title={t('hideFilterBar')}
        onClick={onDismiss}
        className="
          ms-auto shrink-0 rounded-md p-1 text-muted-foreground
          hover:bg-accent hover:text-foreground
        "
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
};
