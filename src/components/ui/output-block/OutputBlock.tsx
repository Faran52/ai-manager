import { useTranslation } from 'react-i18next';

import { MarkdownView } from '../markdown-view/MarkdownView';

import type { FC } from 'react';

export interface OutputBlockProps {
  // Already translated by the caller: "output", "stderr", "result", "Content".
  readonly label: string;
  readonly text: string;
}

/*
 * A hard cap on what reaches the DOM. Past it the tail is dropped with the count
 * still on the label, so a huge payload never bloats the tree.
 */
const MAX_BODY_CHARS = 20_000;

/*
 * The tool card is the only thing that collapses, so output never hides behind a
 * second disclosure. The body is height-bounded and scrolls instead.
 */
export const OutputBlock: FC<OutputBlockProps> = ({ label, text }) => {
  const { t } = useTranslation('common');
  const body = text.length > MAX_BODY_CHARS ? `${text.slice(0, MAX_BODY_CHARS)}\n…` : text;

  return (
    <div data-output-block>
      <span className="
        text-eyebrow font-medium tracking-wide text-dim uppercase
      "
      >
        {label}
        {' · '}
        {t('charCount', { count: text.length })}
      </span>
      <div className="mt-1.5 max-h-80 overflow-y-auto overscroll-contain">
        <MarkdownView text={body} />
      </div>
    </div>
  );
};
