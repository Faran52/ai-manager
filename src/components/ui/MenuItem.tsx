import type {
  FC,
  MouseEventHandler,
  ReactNode,
} from 'react';

export interface MenuItemProps {
  readonly children: ReactNode;
  readonly icon: ReactNode;
  readonly onClick: MouseEventHandler<HTMLButtonElement>;
}

export const MenuItem: FC<MenuItemProps> = ({
  children,
  icon,
  onClick,
}) => {
  return (
    <button type="button" role="menuitem" className="menu-item" onClick={onClick}>
      {icon}
      {children}
    </button>
  );
};
