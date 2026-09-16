// Mapped rather than a `Record` alias, which would make the recursion circular.
export type JsonObject = { readonly [key in string]: JsonValue };

export type JsonValue = string | number | boolean | null | readonly JsonValue[] | JsonObject;

export const isJsonArray = (value: JsonValue | undefined): value is readonly JsonValue[] => {
  return Array.isArray(value);
};

export const isJsonObject = (value: JsonValue | undefined): value is JsonObject => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isContainer = (value: unknown): value is JsonObject | readonly JsonValue[] => {
  return typeof value === 'object' && value !== null;
};

export const parseJsonContainer = (text: string): JsonValue => {
  try {
    const parsed: unknown = JSON.parse(text);

    return isContainer(parsed) ? parsed : null;
  }
  catch {
    return null;
  }
};

// Readers of parsed config and history files, whose shape is never promised.
export const valueAt = (source: JsonValue | undefined, key: string): JsonValue | undefined => {
  return isJsonObject(source) ? source[key] : undefined;
};

export const objectAt = (source: JsonValue | undefined, key: string): JsonObject | undefined => {
  const value = valueAt(source, key);

  return isJsonObject(value) ? value : undefined;
};

export const textAt = (source: JsonValue | undefined, key: string): string | undefined => {
  const value = valueAt(source, key);

  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

// For identifiers and labels, where surrounding whitespace is noise. Message
// text keeps its whitespace, so it reads through textAt.
export const trimmedTextAt = (source: JsonValue | undefined, key: string): string | undefined => {
  const value = textAt(source, key)?.trim();

  return value != null && value.length > 0 ? value : undefined;
};

export const numberAt = (source: JsonValue | undefined, key: string): number | undefined => {
  const value = valueAt(source, key);

  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};
