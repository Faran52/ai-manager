import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: readonly (string | false | null | undefined)[]): string => {
  return twMerge(clsx(inputs));
};
