import {
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@radix-ui/react-dropdown-menu';
import { ChevronRight } from 'lucide-react';

import { cn } from '@utils/cnUtils';

import { MENU_SURFACE } from './Menu';

import type { FC, ReactNode } from 'react';

export interface MenuSubProps {
  readonly label: string;
  readonly icon?: ReactNode;
  // What the row is currently set to, so the list need not be opened to read it.
  readonly value: string;
  readonly children: ReactNode;
}

export const MenuSub: FC<MenuSubProps> = ({
  label,
  icon,
  value,
  children,
}) => {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="menu-item">
        {icon}
        <span className="grow">{label}</span>
        <span className="menu-hint">{value}</span>
        {/* Logical, not physical: in Arabic the chevron points the other way,
            and so does the key that opens the submenu. */}
        <ChevronRight className="
          size-3 text-dim
          rtl:-scale-x-100
        "
        />
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent className={cn(MENU_SURFACE)} sideOffset={4}>
          {children}
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
};
