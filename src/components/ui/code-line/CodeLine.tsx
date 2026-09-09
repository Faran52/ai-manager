import type { FC } from 'react';

export interface CodeLineProps {
  readonly text: string;
}

export const CodeLine: FC<CodeLineProps> = ({ text }) => {
  return (
    <pre
      className="
        overflow-x-auto rounded-lg bg-code p-3 font-mono text-figure/relaxed
        text-code-foreground
      "
      data-code-line
    >
      {text}
    </pre>
  );
};
