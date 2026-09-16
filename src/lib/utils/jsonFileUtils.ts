import { readFile } from 'node:fs/promises';

import { parseJsonContainer } from './jsonUtils';

import type { JsonValue } from './jsonUtils';

// A config file that is missing or malformed reads as null, the same as an empty one.
export const readJsonFile = async (path: string): Promise<JsonValue> => {
  try {
    return parseJsonContainer(await readFile(path, 'utf8'));
  }
  catch {
    return null;
  }
};
