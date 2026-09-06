import { useTranslation } from 'react-i18next';

import { SegmentedControl } from '@ui/index';

import { fontSizes, useFontSize } from './hooks/useFontSize';

import type { FC } from 'react';
import type { FontSize } from './hooks/useFontSize';

// Keys, not text, the map lives outside the component where t is unavailable.
const LABEL_KEYS: Record<FontSize, string> = {
  compact: 'textSizeCompact',
  normal: 'textSizeNormal',
  large: 'textSizeLarge',
};

export const FontSizePicker: FC = () => {
  const { t } = useTranslation('common');
  const { fontSize, setFontSize } = useFontSize();

  return (
    <SegmentedControl
      label={t('textSize')}
      value={fontSize}
      options={fontSizes.map((size) => {
        return {
          value: size,
          label: t(LABEL_KEYS[size]),
        };
      })}
      onChange={setFontSize}
    />
  );
};
