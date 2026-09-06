import { DropdownMenuCheckboxItem, DropdownMenuItemIndicator } from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';

import type { FC, ReactNode } from 'react';

export interface MenuCheckboxItemProps {
  readonly children: ReactNode;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  // A count reading as what the list would show if this row were the filter.
  readonly hint?: ReactNode;
}

export const MenuCheckboxItem: FC<MenuCheckboxItemProps> = ({
  children,
  checked,
  onChange,
  hint,
}) => {
  return (
    <DropdownMenuCheckboxItem
      className="menu-item"
      checked={checked}
      /*
       * A filter list is read as a set, so ticking one row keeps the menu open
       * rather than closing it and making the reader reopen it per agent.
       */
      onSelect={(event) => {
        event.preventDefault();
      }}
      onCheckedChange={onChange}
    >
      <span className="menu-checkbox-indicator">
        <DropdownMenuItemIndicator>
          <Check className="size-3" />
        </DropdownMenuItemIndicator>
      </span>
      <span className="grow">{children}</span>
      {hint != null && <span className="menu-hint">{hint}</span>}
    </DropdownMenuCheckboxItem>
  );
};
