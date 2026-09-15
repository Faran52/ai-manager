import { initI18n } from '@i18n/index';

import { ToastProvider } from '@ui/index';

import { HistoryAppView } from './partials/HistoryAppView';

import type { FC } from 'react';

initI18n();

// The one Toast stack the whole app shares lives above everything that can
// report through it, so two unrelated notices never land on top of each other.
export const HistoryApp: FC = () => {
  return (
    <ToastProvider>
      <HistoryAppView />
    </ToastProvider>
  );
};
