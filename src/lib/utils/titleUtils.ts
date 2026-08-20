import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import { truncate } from './formatUtils';

const FILE_URL_PREFIX = 'file://';

export const fileURLName = (url: string): string | undefined => {
  try {
    return basename(fileURLToPath(url));
  }
  catch {
    return undefined;
  }
};

// A session label: the stored text trimmed, or the file name behind a file:// URL.
export const humanTitle = (stored: string | null | undefined): string | undefined => {
  const title = stored?.trim() ?? '';

  if (title.startsWith(FILE_URL_PREFIX)) {
    // A bare file:// URL resolves to an empty basename, which labels nothing.
    const name = fileURLName(title);

    return name != null && name.length > 0 ? name : undefined;
  }

  return title.length > 0 ? title : undefined;
};

// A preview: the human title collapsed onto one line and clamped.
export const humanPreview = (text: string | null | undefined, maxChars: number): string | undefined => {
  const named = humanTitle(text?.replace(/\s+/gu, ' '));

  return named == null ? undefined : truncate(named, maxChars);
};
