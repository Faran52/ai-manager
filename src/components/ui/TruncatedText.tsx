import { CodeLine } from './CodeLine';

import type { FC } from 'react';

export interface TruncatedTextProps {
  readonly label: string;
  readonly text: string;
}

const MAX_BODY_CHARS = 4_000;

export const TruncatedText: FC<TruncatedTextProps> = ({ label, text }) => {
  if (text.length <= MAX_BODY_CHARS) {
    return <CodeLine text={text} />;
  }

  return (
    <details data-truncated-text>
      <summary className="cursor-pointer text-xs text-primary">
        {label}
        {' '}
        (
        {String(text.length)}
        {' '}
        chars)
      </summary>
      <CodeLine text={text} />
    </details>
  );
};
