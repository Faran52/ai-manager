import { useTranslation } from 'react-i18next';

import { languages } from '@i18n/index';

import { useSystemLanguage } from './hooks/useSystemLanguage';

import type { FC } from 'react';

const SYSTEM = 'system';

// A native `<select>`: one of seven values, no icons, no submenu. The OS list is
// already keyboard-navigable and typeahead-searchable in every locale.
export const LanguagePicker: FC = () => {
  const { t, i18n } = useTranslation('common');
  const {
    following,
    follow,
    choose,
  } = useSystemLanguage();

  return (
    <select
      aria-label={t('languageChange')}
      className="select-control"
      value={following ? SYSTEM : i18n.language}
      onChange={(event) => {
        if (event.target.value === SYSTEM) {
          follow();

          return;
        }

        choose(event.target.value);
      }}
    >
      <option value={SYSTEM}>{t('languageSystem')}</option>
      {languages.map((option) => {
        return <option key={option.id} value={option.id}>{option.label}</option>;
      })}
    </select>
  );
};
