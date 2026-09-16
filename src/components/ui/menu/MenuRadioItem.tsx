import {
  DropdownMenuItemIndicator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';

import type { ReactNode } from 'react';

export interface MenuRadioOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

export interface MenuRadioGroupProps<T extends string> {
  readonly options: readonly MenuRadioOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
}

/**
 * The trailing check is what the value is set to, so it sits on the trailing
 * edge. A leading mark on the same row would mean "where you are" instead.
 * Typed by its options, so a caller gets its own union back rather than a string.
 */
export const MenuRadioGroup = <T extends string>({
  options,
  value,
  onChange,
}: MenuRadioGroupProps<T>): ReactNode => {
  const pick = (next: string): void => {
    const chosen = options.find((option) => {
      return option.value === next;
    });

    // v8 ignore next -- the menu only ever emits one of its own options
    if (chosen != null) {
      onChange(chosen.value);
    }
  };

  return (
    <DropdownMenuRadioGroup value={value} onValueChange={pick}>
      {options.map((option): ReactNode => {
        return (
          <DropdownMenuRadioItem className="menu-item" key={option.value} value={option.value}>
            <span className="grow">{option.label}</span>
            <DropdownMenuItemIndicator>
              <Check className="size-3.5 text-primary" />
            </DropdownMenuItemIndicator>
          </DropdownMenuRadioItem>
        );
      })}
    </DropdownMenuRadioGroup>
  );
};
