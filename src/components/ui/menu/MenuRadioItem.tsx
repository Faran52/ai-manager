import {
  DropdownMenuItemIndicator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';

import type { FC, ReactNode } from 'react';

export interface MenuRadioOption {
  readonly value: string;
  readonly label: string;
}

export interface MenuRadioGroupProps {
  readonly options: readonly MenuRadioOption[];
  readonly value: string;
  readonly onChange: (value: string) => void;
}

// The trailing check is what the value is set to, so it sits on the trailing
// edge. A leading mark on the same row would mean "where you are" instead.
export const MenuRadioGroup: FC<MenuRadioGroupProps> = ({
  options,
  value,
  onChange,
}) => {
  return (
    <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
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
