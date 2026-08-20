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

// Parses text that may not be JSON, yielding `null` for anything without records to walk.
export const parseJsonContainer = (text: string): JsonValue => {
  try {
    const parsed: unknown = JSON.parse(text);

    return isContainer(parsed) ? parsed : null;
  }
  catch {
    return null;
  }
};
