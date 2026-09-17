import { cn } from '@utils/cnUtils';

import type { FC, ReactNode } from 'react';

export interface SectionHeaderProps {
  readonly icon: ReactNode;
  readonly label: string;
  readonly action?: ReactNode;
  // A running total beside the label, mono, the way the shell's columns count.
  readonly count?: number | undefined;
  /*
   * "eyebrow" is the tracked uppercase label a report section wears. "plain" is
   * the sentence-case name a sidebar column wears.
   */
  readonly casing?: 'eyebrow' | 'plain';
}

export const SectionHeader: FC<SectionHeaderProps> = ({
  icon,
  label,
  action,
  count,
  casing = 'eyebrow',
}) => {
  const eyebrow = casing === 'eyebrow';

  return (
    <div className={cn(`
      flex shrink-0 items-center gap-1.5 px-3 pt-3 pb-1 font-semibold
    `, eyebrow
      ? 'text-body tracking-wider text-muted-foreground uppercase'
      : 'text-ui text-foreground-2')}
    >
      {icon}
      <span>{label}</span>
      {count != null && (
        <span className="font-mono text-figure font-normal text-dim">{count}</span>
      )}
      {action != null && (
        <span className={cn('ms-auto font-normal', eyebrow && `
          tracking-normal normal-case
        `)}
        >
          {action}
        </span>
      )}
    </div>
  );
};
