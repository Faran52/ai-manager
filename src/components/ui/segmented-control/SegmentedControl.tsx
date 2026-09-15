import { useId } from 'react';

import { motion } from 'motion/react';

import { controlTransition } from '../constants';
import { useReducedMotion } from '../hooks/useReducedMotion';

import type { ReactElement } from 'react';

export interface SegmentedOption<TValue extends string> {
  readonly value: TValue;
  readonly label: string;
}

export interface SegmentedControlProps<TValue extends string> {
  readonly options: readonly SegmentedOption<TValue>[];
  readonly value: TValue;
  readonly onChange: (value: TValue) => void;
  readonly label: string;
}

const INSTANT = { duration: 0 };

/*
 * Native radios in a fieldset, so the browser owns the arrow keys, roving focus
 * and the single tab stop. Generic in its value so a caller gets its own union
 * back from onChange, rather than a type guard for a case that cannot arise.
 */
export const SegmentedControl = <TValue extends string>({
  options,
  value,
  onChange,
  label,
}: SegmentedControlProps<TValue>): ReactElement => {
  // Two segmented controls on one pane would otherwise share a radio group.
  const groupId = useId();
  const reduceMotion = useReducedMotion();

  return (
    <fieldset className="segmented">
      <legend className="sr-only">{label}</legend>
      {options.map((option) => {
        const checked = option.value === value;

        return (
          <label className="segmented-option" key={option.value}>
            <input
              type="radio"
              name={groupId}
              value={option.value}
              checked={checked}
              onChange={() => {
                onChange(option.value);
              }}
            />
            {checked && (
              <motion.span
                aria-hidden="true"
                className="segmented-thumb"
                layoutId={`${groupId}-thumb`}
                transition={reduceMotion ? INSTANT : controlTransition}
              />
            )}
            <span className="segmented-label">{option.label}</span>
          </label>
        );
      })}
    </fieldset>
  );
};
