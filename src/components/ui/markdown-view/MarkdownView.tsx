import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AnimatePresence, motion } from 'motion/react';

import { hasMarkdownMarkup } from '@utils/markdownUtils';

import { CodeLine } from '../code-line/CodeLine';
import { fadeTransition } from '../constants';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { MarkdownText } from '../markdown-text/MarkdownText';
import { SegmentedControl } from '../segmented-control/SegmentedControl';

import type { FC } from 'react';

type View = 'parsed' | 'raw';

export interface MarkdownViewProps {
  readonly text: string;
  /*
   * Assistant prose, reasoning and injected instruction bodies are Markdown by
   * nature, so plain sentences among them still parse (inline emphasis, links).
   * Tool output and a typed message stay raw when they carry no Markdown.
   * Either way the Parsed / Raw card appears only when a real Markdown block is
   * present, so a one line answer never grows a toggle.
   */
  readonly trusted?: boolean;
}

const VIEWS: readonly View[] = ['parsed', 'raw'];

const LABEL_KEYS: Record<View, string> = {
  parsed: 'viewParsed',
  raw: 'viewRaw',
};

const INSTANT = { duration: 0 };

export const MarkdownView: FC<MarkdownViewProps> = ({ text, trusted = false }) => {
  const { t } = useTranslation('common');
  const [view, setView] = useState<View>('parsed');
  const reduceMotion = useReducedMotion();
  const structured = useMemo(() => {
    return hasMarkdownMarkup(text);
  }, [text]);

  if (!structured) {
    return trusted ? <MarkdownText text={text} /> : <CodeLine text={text} />;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card/40" data-markdown-view>
      <div className="flex justify-end border-b border-border px-2 py-1">
        <SegmentedControl
          label={t('viewToggle')}
          value={view}
          options={VIEWS.map((option) => {
            return {
              value: option,
              label: t(LABEL_KEYS[option]),
            };
          })}
          onChange={setView}
        />
      </div>
      <div className="px-3 py-2">
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduceMotion ? INSTANT : fadeTransition}
          >
            {view === 'parsed' ? <MarkdownText text={text} /> : <CodeLine text={text} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
