import { clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/*
 * tailwind-merge cannot tell a custom text-* size from a text-* colour, so without
 * this it files text-ui in text-dim's slot, drops one, and the size is inherited.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['eyebrow', 'figure', 'body', 'ui', 'value', 'metric'] }],
    },
  },
});

export const cn = (...inputs: readonly (string | false | null | undefined)[]): string => {
  return twMerge(clsx(inputs));
};
