import { cn } from '@utils/cnUtils';

import type { FC } from 'react';

export interface TextInputProps {
  readonly value: string;
  readonly onInput: (value: string) => void;
  readonly placeholder?: string;
  readonly label: string;
  readonly className?: string;
  readonly disabled?: boolean;
}

export const TextInput: FC<TextInputProps> = ({
  value,
  onInput,
  placeholder,
  label,
  className,
  disabled = false,
}) => {
  return (
    <input
      type="text"
      value={value}
      onInput={(event) => {
        onInput(event.currentTarget.value);
      }}
      placeholder={placeholder}
      aria-label={label}
      disabled={disabled}
      className={cn(
        `
          h-8 w-full rounded-md border border-transparent bg-muted px-2.5
          text-sm text-foreground outline-none
        `,
        `
          placeholder:text-muted-foreground
          focus:border-ring focus:bg-background
          disabled:cursor-not-allowed disabled:opacity-50
        `,
        className,
      )}
    />
  );
};
