import { useTranslation } from 'react-i18next';

import { SegmentedControl } from '@ui/index';

import { updateChecks, useUpdateCheck } from './hooks/useUpdateCheck';

import type { FC } from 'react';
import type { UpdateCheck } from './hooks/useUpdateCheck';

// Keys, not text, the map lives outside the component where t is unavailable.
const LABEL_KEYS: Record<UpdateCheck, string> = {
  launch: 'updateCheckLaunch',
  never: 'updateCheckNever',
};

export const UpdatePreference: FC = () => {
  const { t } = useTranslation('common');
  const { updateCheck, setUpdateCheck } = useUpdateCheck();

  return (
    <SegmentedControl
      label={t('settingsUpdates')}
      value={updateCheck}
      options={updateChecks.map((option) => {
        return {
          value: option,
          label: t(LABEL_KEYS[option]),
        };
      })}
      onChange={setUpdateCheck}
    />
  );
};
