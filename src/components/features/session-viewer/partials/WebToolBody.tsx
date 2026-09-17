import {
  ExternalLink,
  Globe2,
  Search,
} from 'lucide-react';

import { webUrl } from '../utils/webUtils';

import type { WebFetchInput, WebSearchInput } from '@services/history/types';
import type { FC } from 'react';

type WebToolInput = WebFetchInput | WebSearchInput;

export interface WebToolBodyProps {
  readonly input: WebToolInput;
}

export const WebToolBody: FC<WebToolBodyProps> = ({ input }) => {
  if (input.kind === 'web-search') {
    return (
      <div className="flex items-start gap-2.5" data-web-tool-body="search">
        <span className="
          grid size-7 shrink-0 place-items-center rounded-md bg-primary/10
          text-primary
        "
        >
          <Search className="size-3.5" />
        </span>
        <div className="min-w-0 pt-0.5">
          <p className="
            text-figure tracking-wide text-muted-foreground uppercase
          "
          >
            query
          </p>
          <p className="text-sm wrap-break-word text-foreground">{input.query}</p>
        </div>
      </div>
    );
  }

  const url = webUrl(input.url);

  return (
    <div className="space-y-2" data-web-tool-body="fetch">
      <div className="flex items-start gap-2.5">
        <span className="
          grid size-7 shrink-0 place-items-center rounded-md bg-primary/10
          text-primary
        "
        >
          <Globe2 className="size-3.5" />
        </span>
        <div className="min-w-0 pt-0.5">
          <p className="
            text-figure tracking-wide text-muted-foreground uppercase
          "
          >
            {url?.hostname ?? 'url'}
          </p>
          {url == null
            ? <p className="font-mono text-body break-all text-foreground">{input.url}</p>
            : (
                <a
                  href={url.href}
                  target="_blank"
                  rel="noreferrer"
                  className="
                    inline-flex max-w-full items-center gap-1 text-body
                    text-primary
                    hover:underline
                  "
                >
                  <span className="truncate">{input.url}</span>
                  <ExternalLink className="size-3 shrink-0" />
                </a>
              )}
        </div>
      </div>
      {input.prompt != null && input.prompt.length > 0 && (
        <div className="
          border-s border-border ps-2 text-body text-muted-foreground
        "
        >
          {input.prompt}
        </div>
      )}
    </div>
  );
};
