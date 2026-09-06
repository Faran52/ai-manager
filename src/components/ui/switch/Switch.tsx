import { Switch as SwitchRoot, SwitchThumb } from '@radix-ui/react-switch';

import { cn } from '@utils/cnUtils';

import type { FC } from 'react';

export interface SwitchProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly label: string;
  readonly disabled?: boolean;
}

export const Switch: FC<SwitchProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
}) => {
  return (
    <SwitchRoot
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      aria-label={label}
      className={cn(
        `
          relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border
          border-border transition-colors
        `,
        `
          focus-visible:ring-2 focus-visible:ring-ring
          focus-visible:ring-offset-2
        `,
        'disabled:cursor-not-allowed disabled:opacity-50',
        `
          data-[state=checked]:border-primary data-[state=checked]:bg-primary
          data-[state=unchecked]:bg-muted
        `,
      )}
    >
      {/*
        * A CSS transform rather than a Motion spring: the travel is signed, and
        * reading the document direction during render would break server
        * rendering. Tailwind's rtl variant knows the direction without asking.
        * The duration is matched to controlTransition by eye.
        */}
      <SwitchThumb
        className={cn(
          `
            pointer-events-none absolute inset-s-0.5 size-4 rounded-full
            transition-transform duration-200 ease-out
          `,
          `
            data-[state=checked]:translate-x-4
            data-[state=checked]:bg-primary-foreground
            rtl:data-[state=checked]:-translate-x-4
          `,
          'data-[state=unchecked]:bg-muted-foreground',
        )}
      />
    </SwitchRoot>
  );
};
