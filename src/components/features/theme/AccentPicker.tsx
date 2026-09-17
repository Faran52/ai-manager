import { useTranslation } from 'react-i18next';

import { cn } from '@utils/cnUtils';

import {
  accentNames,
  DEFAULT_CUSTOM_ACCENT,
  isAccentName,
  useAccent,
} from './hooks/useAccent';

import type { FC } from 'react';
import type { AccentName } from './hooks/useAccent';

// Keys, not text, the map lives outside the component where t is unavailable.
const LABEL_KEYS: Record<AccentName, string> = {
  teal: 'accentTeal',
  iris: 'accentIris',
  amber: 'accentAmber',
  rose: 'accentRose',
  lime: 'accentLime',
  sky: 'accentSky',
};

/*
 * A swatch is already a colour, so selection can be neither a fill nor a border
 * without changing what is shown. It takes a ring, same as a selected session.
 */
const SWATCH = `
  size-5 rounded-full border border-border transition-[box-shadow]
  focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
  focus-visible:ring-offset-card
`;
const SELECTED = 'ring-2 ring-foreground ring-offset-2 ring-offset-card';

export const AccentPicker: FC = () => {
  const { t } = useTranslation('common');
  const { accent, setAccent } = useAccent();
  const custom = isAccentName(accent) ? DEFAULT_CUSTOM_ACCENT : accent;

  return (
    <div className="flex items-center gap-2">
      {accentNames.map((name) => {
        return (
          <button
            key={name}
            type="button"
            data-accent={name}
            aria-label={t(LABEL_KEYS[name])}
            aria-pressed={accent === name}
            className={cn(SWATCH, 'bg-primary', accent === name && SELECTED)}
            onClick={() => {
              setAccent(name);
            }}
          />
        );
      })}
      {/*
        * The seventh swatch is the OS colour picker: a native control, so recent
        * colours and accessibility come from the system.
        */}
      <label
        className={cn(SWATCH, 'relative cursor-pointer', !isAccentName(accent) && SELECTED)}
        style={{ background: isAccentName(accent) ? undefined : accent }}
      >
        <span className="sr-only">{t('accentCustom')}</span>
        {isAccentName(accent) && (
          <span
            aria-hidden
            className="absolute inset-0 rounded-full bg-(image:--accent-wheel)"
          />
        )}
        <input
          type="color"
          value={custom}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
          onChange={(event) => {
            setAccent(event.target.value);
          }}
        />
      </label>
    </div>
  );
};
