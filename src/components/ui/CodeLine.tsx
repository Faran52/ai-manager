import type { FC } from 'react';

export interface CodeLineProps {
  readonly text: string;
}

export const CodeLine: FC<CodeLineProps> = ({ text }) => {
  return (
    <pre
      className="
        overflow-x-auto rounded-lg bg-zinc-900 p-3 font-mono text-xs/relaxed
        text-zinc-100
      "
      data-code-line
    >
      {text}
    </pre>
  );
};
