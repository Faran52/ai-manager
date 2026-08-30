import { useTranslation } from 'react-i18next';

import type { FC } from 'react';

export const Spinner: FC = () => {
  const { t } = useTranslation('common');

  return (
    <span role="status" aria-label={t('loading')} className="inline-flex">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="size-4 animate-spin text-primary"
        data-spinner
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </span>
  );
};
