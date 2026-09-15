import { ExternalLink } from 'lucide-react';

import { OutputBlock } from '@ui/index';

import { resultUrls } from '../utils/webUtils';

import type { FC } from 'react';

export interface WebOutcomeBodyProps {
  readonly label: string;
  readonly text: string;
}

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
                  border-border bg-background/60 px-2 py-1 text-body
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
      <OutputBlock label={label} text={text} />
    </div>
  );
};
