import ReactMarkdown from 'react-markdown';

import remarkGfm from 'remark-gfm';

import { CodeBlock } from './CodeBlock';

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

    return <CodeBlock code={textOf(children).replace(/\n$/u, '')} language={languageOf(className)} />;
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
        prose-sm space-y-2 wrap-break-word
        [&_h1]:text-base
        [&_h2]:text-sm
        [&_li]:ml-4
        [&_ol]:list-decimal
        [&_ul]:list-disc
      "
      data-markdown
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
};
