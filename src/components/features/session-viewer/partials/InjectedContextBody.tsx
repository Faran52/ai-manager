import { useTranslation } from 'react-i18next';

import { Disclosure, MarkdownView } from '@ui/index';

import { parseInjectedContext, stripEnvelopes } from '../utils/injectedContextUtils';

import { RowsList } from './RowsList';

import type { FC } from 'react';

export interface InjectedContextBodyProps {
  readonly text: string;
}

const LABEL_CLASS = 'text-eyebrow font-medium tracking-wide text-dim uppercase';

/*
 * A known context shape splits into parts. Anything unrecognised goes to
 * MarkdownView, which parses only if it reads as Markdown.
 */
export const InjectedContextBody: FC<InjectedContextBodyProps> = ({ text }) => {
  const { t } = useTranslation('session');
  const parsed = parseInjectedContext(text);

  if (parsed == null) {
    return <MarkdownView text={stripEnvelopes(text)} bare />;
  }

  return (
    <div className="space-y-3">
      {parsed.instructions != null && (
        <div className="space-y-1">
          <p className={LABEL_CLASS}>{t('injectedInstructions')}</p>
          <MarkdownView text={parsed.instructions} trusted bare />
        </div>
      )}
      {parsed.environment != null && (
        <div className="space-y-1">
          <p className={LABEL_CLASS}>{t('injectedEnvironment')}</p>
          <RowsList rows={parsed.environment} />
        </div>
      )}
      {parsed.plugins != null && (
        <Disclosure
          triggerClassName="gap-2 text-body text-muted-foreground"
          summary={(
            <>
              <span>{t('injectedPlugins')}</span>
              <span className="font-mono text-figure text-dim">{parsed.plugins.length}</span>
            </>
          )}
        >
          <ul className="
            space-y-0.5 pt-1 font-mono text-body text-muted-foreground
          "
          >
            {parsed.plugins.map((name) => {
              return <li key={name}>{name}</li>;
            })}
          </ul>
        </Disclosure>
      )}
      {parsed.rest != null && <MarkdownView text={stripEnvelopes(parsed.rest)} bare />}
    </div>
  );
};
