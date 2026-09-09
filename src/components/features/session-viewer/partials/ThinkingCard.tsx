import { useTranslation } from 'react-i18next';

import { Brain } from 'lucide-react';

import { Disclosure, MarkdownView } from '@ui/index';

import type { FC } from 'react';

export interface ThinkingCardProps {
  readonly thinking: string;
}

export const ThinkingCard: FC<ThinkingCardProps> = ({ thinking }) => {
  const { t } = useTranslation('session');

  return (
    <Disclosure
      className="rounded-lg border border-primary/30 bg-primary/5"
      triggerClassName="gap-1.5 px-3 py-1.5 text-body font-medium text-primary"
      summary={(
        <>
          <Brain className="size-3.5 shrink-0" />
          <span>{t('thinking')}</span>
        </>
      )}
    >
      {/* Codex and Gemini both record reasoning as `**subject**` headers, so the
          body is Markdown by nature and renders parsed without asking. */}
      <div className="
        border-t border-primary/20 px-3 py-2 text-muted-foreground
      "
      >
        <MarkdownView text={thinking} trusted />
      </div>
    </Disclosure>
  );
};
