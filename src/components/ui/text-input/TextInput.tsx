import { cn } from '@utils/cnUtils';

import type { FC } from 'react';

export interface TextInputProps {
  readonly value: string;
  readonly onInput: (value: string) => void;
  readonly placeholder?: string;
  readonly label: string;
  readonly className?: string;
  readonly disabled?: boolean;
  // A field opened to add one thing is finished with the keyboard, not a click.
  readonly onEnter?: (() => void)
    | undefined;
}

export const TextInput: FC<TextInputProps> = ({
  value,
  onInput,
  placeholder,
  label,
  className,
  disabled = false,
  onEnter,
}) => {
  return (
    <input
      type="text"
      value={value}
      onInput={(event) => {
        onInput(event.currentTarget.value);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && onEnter != null) {
          event.preventDefault();
          onEnter();
        }
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
