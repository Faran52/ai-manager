// Global test setup, wired from `vitest.config.ts`. Every global mock belongs here.

import { initI18n } from '@i18n/index';

// Components call useTranslation directly, so the runtime has to exist before
// any of them render or they would only ever show raw keys.
initI18n();

export {};
