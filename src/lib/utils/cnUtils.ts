import { clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/*
 * tailwind-merge cannot tell a custom text-* size from a text-* colour, so
 * without this it files text-ui in the same slot as text-dim, drops one, and
 * the element falls back to its inherited size.
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
