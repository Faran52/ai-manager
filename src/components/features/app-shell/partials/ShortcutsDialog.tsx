import { useTranslation } from 'react-i18next';

import { Keyboard } from 'lucide-react';

import { appShortcuts, shortcutOrder } from '@config/shortcuts';

import { shortcutLabel } from '@utils/shortcutUtils';

import { Modal } from '@ui/index';

import type { ShortcutId } from '@config/shortcuts';
import type { FC } from 'react';

export interface ShortcutsDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

// Keys, not text, the map lives outside the component where t is unavailable.
const LABEL_KEYS: Record<ShortcutId, string> = {
  openSearch: 'shortcutOpenSearch',
  viewSessions: 'shortcutViewSessions',
  viewAnalytics: 'shortcutViewAnalytics',
  viewHealth: 'shortcutViewHealth',
  reload: 'shortcutReload',
  toggleNavigator: 'shortcutToggleNavigator',
  showShortcuts: 'shortcutShowShortcuts',
};

const isApplePlatform = (): boolean => {
  return navigator.platform.startsWith('Mac');
};

export const ShortcutsDialog: FC<ShortcutsDialogProps> = ({ open, onClose }) => {
  const { t } = useTranslation('common');
  const apple = isApplePlatform();

  return (
    <Modal open={open} onClose={onClose} labelledBy="shortcuts-heading" widthClass="max-w-md">
      <div className="p-5">
        <h2
          id="shortcuts-heading"
          className="flex items-center gap-2 text-base font-semibold"
        >
          <Keyboard className="size-4 text-primary" />
          {t('shortcuts')}
        </h2>
        <dl className="mt-4 grid gap-1" data-shortcut-list>
          {shortcutOrder.map((id) => {
            return (
              <div
                key={id}
                className="
                  flex items-center justify-between gap-4 rounded-md px-2 py-1.5
                  odd:bg-muted/40
                "
              >
                <dt className="text-sm text-foreground">{t(LABEL_KEYS[id])}</dt>
                <dd>
                  <kbd className="
                    rounded-sm border border-border bg-background px-1.5 py-0.5
                    font-mono text-[11px] text-muted-foreground
                  "
                  >
                    {shortcutLabel(appShortcuts[id], apple)}
                  </kbd>
                </dd>
              </div>
            );
          })}
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">{t('shortcutsHint')}</p>
      </div>
    </Modal>
  );
};
