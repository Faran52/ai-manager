import { Check } from 'lucide-react';

import type {
  FC,
  MouseEventHandler,
  ReactNode,
} from 'react';

export interface MenuCheckboxItemProps {
  readonly children: ReactNode;
  readonly checked: boolean;
  readonly onClick: MouseEventHandler<HTMLButtonElement>;
}

export const MenuCheckboxItem: FC<MenuCheckboxItemProps> = ({
  children,
  checked,
  onClick,
}) => {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      className="menu-checkbox-item"
      onClick={onClick}
    >
      <span className="menu-checkbox-indicator" data-checked={checked}>
        <Check className="size-3" />
      </span>
      {children}
    </button>
  );
};
