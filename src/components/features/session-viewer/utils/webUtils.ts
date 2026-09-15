const URL_PATTERN = /https?:\/\/\S+/gu;
// Prose wraps a link in punctuation, and the match is greedy enough to swallow it.
const TRAILING_URL_CHARS = new Set([')', ',', '.', ';', ']']);

const cleanUrl = (value: string): string => {
  let cleaned = value;

  while (TRAILING_URL_CHARS.has(cleaned.slice(-1))) {
    cleaned = cleaned.slice(0, -1);
  }

  return cleaned;
};

// The distinct, parseable links a web result cites, six at most.
export const resultUrls = (text: string): readonly URL[] => {
  const seen = new Set<string>();

  return [...text.matchAll(URL_PATTERN)].flatMap((match) => {
    const raw = cleanUrl(match[0]);

    if (seen.has(raw)) {
      return [];
    }

    try {
      const url = new URL(raw);

      seen.add(raw);

      return [url];
    }
    catch {
      return [];
    }
  }).slice(0, 6);
};

// A fetch target worth linking: http or https, and nothing else.
export const webUrl = (value: string): URL | undefined => {
  try {
    const url = new URL(value);

    return url.protocol === 'http:' || url.protocol === 'https:' ? url : undefined;
  }
  catch {
    return undefined;
  }
};
