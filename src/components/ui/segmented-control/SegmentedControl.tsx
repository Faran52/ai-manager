import { useId } from 'react';

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

/**
 * Native radios in a fieldset rather than a hand-rolled `role="radiogroup"`.
 * A radio group is a promise about the keyboard — arrow keys, roving focus, one
 * tab stop for the set — and the browser already keeps that promise. Only the
 * appearance is ours.
 *
 * Generic in its value so a caller gets its own union back out of `onChange`.
 * A `string` here would push a type guard into every caller for a case that
 * cannot arise: the only values emitted are the ones passed in.
 */
export const SegmentedControl = <TValue extends string>({
  options,
  value,
  onChange,
  label,
}: SegmentedControlProps<TValue>): ReactElement => {
  // Two segmented controls on one pane would otherwise share a radio group.
  const groupId = useId();

  return (
    <fieldset className="segmented">
      <legend className="sr-only">{label}</legend>
      {options.map((option) => {
        return (
          <label className="segmented-option" key={option.value}>
            <input
              type="radio"
              name={groupId}
              value={option.value}
              checked={option.value === value}
              onChange={() => {
                onChange(option.value);
              }}
            />
            <span>{option.label}</span>
          </label>
        );
      })}
    </fieldset>
  );
};
