import { DropdownMenuLabel } from '@radix-ui/react-dropdown-menu';

import type { FC } from 'react';

export interface MenuLabelProps {
  readonly children: string;
}

// The heading over a group: Filter by, Order by, Agents.
export const MenuLabel: FC<MenuLabelProps> = ({ children }) => {
  return <DropdownMenuLabel className="menu-label">{children}</DropdownMenuLabel>;
};
