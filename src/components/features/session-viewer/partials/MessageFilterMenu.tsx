import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  ListFilter,
  MessagesSquare,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';

import {
  Menu,
  MenuCheckboxItem,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuSub,
} from '@ui/index';

import {
  defaultMessageFilters,
  hasActiveMessageFilters,
  toggleMessageFilter,
} from '../utils/messageFilterUtils';

import type { FC } from 'react';
import type { MessageFilterKey, MessageFilters } from '../utils/messageFilterUtils';

export interface MessageFilterMenuProps {
  readonly filters: MessageFilters;
  readonly onChange: (filters: MessageFilters) => void;
}

const CONTENT_KEYS = ['text', 'thinking', 'tools', 'commands'] as const;

// Participants and Content each open as a submenu rather than spilling every
// checkbox into the parent. The trigger carries data-active when narrowed.
export const MessageFilterMenu: FC<MessageFilterMenuProps> = ({ filters, onChange }) => {
  const { t } = useTranslation('session');
  const [open, setOpen] = useState(false);
  const active = hasActiveMessageFilters(filters);

  const toggle = (key: MessageFilterKey): void => {
    onChange(toggleMessageFilter(filters, key));
  };

  const participantsOn = Number(filters.roles.human) + Number(filters.roles.ai);
  const contentOn = CONTENT_KEYS.filter((key) => {
    return filters.content[key];
  }).length;

  return (
    <div className="shrink-0" data-message-filter-menu>
      <Menu
        align="end"
        label={t('messageFilters')}
        open={open}
        onOpenChange={setOpen}
        trigger={(
          <button
            type="button"
            aria-label={t('filterMessages')}
            aria-expanded={open}
            data-active={active}
            className="sidebar-funnel-trigger"
          >
            <ListFilter className="size-3.5" />
          </button>
        )}
      >
        <MenuLabel>{t('filterBy', { ns: 'sidebar' })}</MenuLabel>
        <MenuSub
          label={t('participants')}
          icon={<MessagesSquare className="size-3.5" />}
          value={`${String(participantsOn)}/2`}
        >
          <MenuCheckboxItem
            checked={filters.roles.human}
            onChange={() => {
              toggle('human');
            }}
          >
            {t('userMessages')}
          </MenuCheckboxItem>
          <MenuCheckboxItem
            checked={filters.roles.ai}
            onChange={() => {
              toggle('ai');
            }}
          >
            {t('assistantMessages')}
          </MenuCheckboxItem>
        </MenuSub>
        <MenuSub
          label={t('contentHeading')}
          icon={<SlidersHorizontal className="size-3.5" />}
          value={`${String(contentOn)}/4`}
        >
          <MenuCheckboxItem
            checked={filters.content.text}
            onChange={() => {
              toggle('text');
            }}
          >
            {t('textMessages')}
          </MenuCheckboxItem>
          <MenuCheckboxItem
            checked={filters.content.thinking}
            onChange={() => {
              toggle('thinking');
            }}
          >
            {t('thinking')}
          </MenuCheckboxItem>
          <MenuCheckboxItem
            checked={filters.content.tools}
            onChange={() => {
              toggle('tools');
            }}
          >
            {t('toolActivity')}
          </MenuCheckboxItem>
          <MenuCheckboxItem
            checked={filters.content.commands}
            onChange={() => {
              toggle('commands');
            }}
          >
            {t('commands')}
          </MenuCheckboxItem>
        </MenuSub>
        {active && (
          <>
            <MenuSeparator />
            <MenuItem
              icon={<RotateCcw className="size-3.5" />}
              onSelect={() => {
                onChange(defaultMessageFilters());
              }}
            >
              {t('resetFilters')}
            </MenuItem>
          </>
        )}
      </Menu>
    </div>
  );
};
