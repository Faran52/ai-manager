import { cn } from '@utils/cnUtils';

import type { FC } from 'react';

export interface TextInputProps {
  readonly value: string;
  readonly onInput: (value: string) => void;
  readonly placeholder?: string;
  readonly label: string;
  readonly className?: string;
}

export const TextInput: FC<TextInputProps> = ({
  value,
  onInput,
  placeholder,
  label,
  className,
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
      className={cn(
        `
          h-8 w-full rounded-md border border-transparent bg-muted px-2.5
          text-sm text-foreground outline-none
        `,
        `
          placeholder:text-muted-foreground
          focus:border-ring focus:bg-background
        `,
        className,
      )}
    />
  );
};
