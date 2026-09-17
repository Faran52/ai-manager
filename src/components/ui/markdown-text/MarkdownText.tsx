import ReactMarkdown from 'react-markdown';

import remarkGfm from 'remark-gfm';

import {
  isBoxArt,
  normalizeBoxDrawing,
  unwrapFileRefs,
} from '@utils/markdownUtils';

import { CodeBlock } from '../code-block/CodeBlock';
import { CodeLine } from '../code-line/CodeLine';

import type { FC, ReactNode } from 'react';

interface CodeProps {
  readonly className?: string | undefined;
  readonly children?: ReactNode;
}

interface AnchorProps {
  readonly children?: ReactNode;
  readonly href?: string | undefined;
}

export interface MarkdownTextProps {
  readonly text: string;
}

const textOf = (node: ReactNode): string => {
  // v8 ignore next -- markdown never produces element children here
  return typeof node === 'string' ? node : '';
};

const languageOf = (className: string | undefined): string => {
  return /language-([a-z0-9_-]+)/u.exec(className ?? '')?.[1] ?? 'text';
};

const components = {
  pre: ({ children }: CodeProps) => {
    return <>{children}</>;
  },
  code: ({ className, children }: CodeProps) => {
    const raw = textOf(children);

    if (className == null && !raw.includes('\n')) {
      return (
        <code className="
          rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.85em]
        "
        >
          {children}
        </code>
      );
    }

    const code = raw.replace(/\n$/u, '');

    // A fenced file tree or loose box art lines up only in a monospace grid, so
    // it skips the syntax highlighter and renders on a plain scrolling line.
    return isBoxArt(code)
      ? <CodeLine text={code} />
      : <CodeBlock code={code} language={languageOf(className)} />;
  },
  a: ({ children, href }: AnchorProps) => {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="text-primary underline"
      >
        {children}
      </a>
    );
  },
};

export const MarkdownText: FC<MarkdownTextProps> = ({ text }) => {
  return (
    <div
      className="
        space-y-2 wrap-break-word
        [&_blockquote]:border-s-2 [&_blockquote]:border-border
        [&_blockquote]:ps-3 [&_blockquote]:text-foreground-2
        [&_h1]:text-value [&_h1]:font-semibold [&_h1]:text-foreground
        [&_h2]:text-ui [&_h2]:font-semibold [&_h2]:text-foreground
        [&_h3]:text-ui [&_h3]:font-semibold [&_h3]:text-foreground
        [&_hr]:my-3 [&_hr]:border-border
        [&_li]:ms-4 [&_li]:text-ui [&_li]:leading-[1.6]
        [&_ol]:list-decimal
        [&_p]:text-ui [&_p]:leading-[1.62]
        [&_table]:my-2 [&_table]:w-full [&_table]:table-fixed
        [&_table]:border-collapse [&_table]:text-figure
        [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1
        [&_td]:align-top
        [&_th]:border [&_th]:border-border [&_th]:bg-muted/40 [&_th]:px-2
        [&_th]:py-1 [&_th]:text-start [&_th]:font-medium [&_th]:text-foreground
        [&_ul]:list-disc
      "
      data-markdown
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {normalizeBoxDrawing(unwrapFileRefs(text))}
      </ReactMarkdown>
    </div>
  );
};
