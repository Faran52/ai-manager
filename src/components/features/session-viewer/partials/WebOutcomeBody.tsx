import { ExternalLink } from 'lucide-react';

import { TruncatedText } from '@ui/index';

import type { FC } from 'react';

export interface WebOutcomeBodyProps {
  readonly label: string;
  readonly text: string;
}

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

const resultUrls = (text: string): readonly URL[] => {
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

export const WebOutcomeBody: FC<WebOutcomeBodyProps> = ({ label, text }) => {
  const urls = resultUrls(text);

  return (
    <div className="space-y-2" data-web-outcome>
      {urls.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {urls.map((url) => {
            return (
              <a
                key={url.href}
                href={url.href}
                target="_blank"
                rel="noreferrer"
                className="
                  inline-flex max-w-52 items-center gap-1 rounded-md border
                  border-border bg-background/60 px-2 py-1 text-[11px]
                  text-muted-foreground
                  hover:border-primary/40 hover:text-primary
                "
              >
                <span className="truncate">{url.hostname}</span>
                <ExternalLink className="size-3 shrink-0" />
              </a>
            );
          })}
        </div>
      )}
      <TruncatedText label={label} text={text} />
    </div>
  );
};
