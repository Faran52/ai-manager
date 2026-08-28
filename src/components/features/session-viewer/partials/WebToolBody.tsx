import {
  ExternalLink,
  Globe2,
  Search,
} from 'lucide-react';

import type { ToolCallInput } from '@services/history/historyService';
import type { FC } from 'react';

type WebToolInput = Extract<ToolCallInput, { readonly kind: 'web-fetch' | 'web-search' }>;

export interface WebToolBodyProps {
  readonly input: WebToolInput;
}

const webUrl = (value: string): URL | undefined => {
  try {
    const url = new URL(value);

    return url.protocol === 'http:' || url.protocol === 'https:' ? url : undefined;
  }
  catch {
    return undefined;
  }
};

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
            text-[10px] tracking-wide text-muted-foreground uppercase
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
            text-[10px] tracking-wide text-muted-foreground uppercase
          "
          >
            {url?.hostname ?? 'url'}
          </p>
          {url == null
            ? <p className="font-mono text-xs break-all text-foreground">{input.url}</p>
            : (
                <a
                  href={url.href}
                  target="_blank"
                  rel="noreferrer"
                  className="
                    inline-flex max-w-full items-center gap-1 text-xs
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
          border-s border-border ps-2 text-xs text-muted-foreground
        "
        >
          {input.prompt}
        </div>
      )}
    </div>
  );
};
