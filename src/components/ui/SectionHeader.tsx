import type { FC, ReactNode } from 'react';

export interface SectionHeaderProps {
  readonly icon: ReactNode;
  readonly label: string;
  readonly action?: ReactNode;
}

export const SectionHeader: FC<SectionHeaderProps> = ({
  icon,
  label,
  action,
}) => {
  return (
    <div className="
      flex shrink-0 items-center gap-1.5 px-3 pt-3 pb-1 text-[11px]
      font-semibold tracking-wider text-muted-foreground uppercase
    "
    >
      {icon}
      <span>{label}</span>
      {action != null && <span className="ms-auto tracking-normal normal-case">{action}</span>}
    </div>
  );
};
