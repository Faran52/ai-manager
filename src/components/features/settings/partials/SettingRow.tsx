import type { FC, ReactNode } from 'react';

export interface SettingRowProps {
  readonly label: string;
  readonly hint?: string | undefined;
  readonly children: ReactNode;
}

// One line of the sheet: a name and its hint on the left, the control on the right.
export const SettingRow: FC<SettingRowProps> = ({
  label,
  hint,
  children,
}) => {
  return (
    <div className="
      flex items-center gap-4 border-b border-border py-3
      last:border-b-0
    "
    >
      <div className="min-w-0 flex-1">
        <p className="text-ui text-foreground">{label}</p>
        {hint != null && <p className="mt-0.5 text-body text-dim">{hint}</p>}
      </div>
      {children}
    </div>
  );
};
