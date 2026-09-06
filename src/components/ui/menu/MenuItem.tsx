import { DropdownMenuItem } from '@radix-ui/react-dropdown-menu';

import type { FC, ReactNode } from 'react';

export interface MenuItemProps {
  readonly children: ReactNode;
  readonly icon?: ReactNode;
  readonly onSelect: () => void;
}

export const MenuItem: FC<MenuItemProps> = ({
  children,
  icon,
  onSelect,
}) => {
  return (
    <DropdownMenuItem
      className="menu-item"
      onSelect={() => {
        onSelect();
      }}
    >
      {icon}
      {children}
    </DropdownMenuItem>
  );
};
