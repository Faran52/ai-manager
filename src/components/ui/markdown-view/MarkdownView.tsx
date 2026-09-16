import {
  useCallback,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import { AnimatePresence, motion } from 'motion/react';

import { cn } from '@utils/cnUtils';
import { hasMarkdownMarkup } from '@utils/markdownUtils';

import { CodeLine } from '../code-line/CodeLine';
import { collapseTransition, fadeTransition } from '../constants';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { MarkdownText } from '../markdown-text/MarkdownText';
import { SegmentedControl } from '../segmented-control/SegmentedControl';

import type { FC } from 'react';

type View = 'parsed' | 'raw';

export interface MarkdownViewProps {
  readonly text: string;
  /*
   * Prose, reasoning and instruction bodies are Markdown by nature; tool output
   * and a typed message stay raw when they carry none. Either way the toggle
   * appears only when a real Markdown block is present.
   */
  readonly trusted?: boolean;
  /*
   * Drop the card's own border and fill. Set it when a parent already frames
   * this (a Disclosure around thinking or injected context), where the card's
   * border would otherwise sit a few pixels inside the parent's as a second rule.
   */
  readonly bare?: boolean;
}

const VIEWS: readonly View[] = ['parsed', 'raw'];

const LABEL_KEYS: Record<View, string> = {
  parsed: 'viewParsed',
  raw: 'viewRaw',
};

const INSTANT = { duration: 0 };

/*
 * The transcript is virtualised, so a card that scrolls out unmounts and its
 * toggle would snap back to Parsed. Keyed on body text so no id is threaded
 * through. ponytail: plain Map, no eviction. LruCache if a heap snapshot cares.
 */
const rememberedView = new Map<string, View>();

export const MarkdownView: FC<MarkdownViewProps> = ({
  text,
  trusted = false,
  bare = false,
}) => {
  const { t } = useTranslation('common');
  const [view, setView] = useState<View>(() => {
    return rememberedView.get(text) ?? 'parsed';
  });
  const reduceMotion = useReducedMotion();
  const structured = useMemo(() => {
    return hasMarkdownMarkup(text);
  }, [text]);
  const selectView = useCallback((next: View): void => {
    setView(next);
    rememberedView.set(text, next);
  }, [text]);

  if (!structured) {
    return trusted ? <MarkdownText text={text} /> : <CodeLine text={text} />;
  }

  return (
    <div
      className={cn('overflow-hidden', !bare && `
        rounded-lg border border-border bg-card/40
      `)}
      data-markdown-view
    >
      <div className={cn('flex justify-end', bare
        ? 'pb-1'
        : 'border-b border-border px-2 py-1')}
      >
        <SegmentedControl
          label={t('viewToggle')}
          value={view}
          options={VIEWS.map((option) => {
            return {
              value: option,
              label: t(LABEL_KEYS[option]),
            };
          })}
          onChange={selectView}
        />
      </div>
      {/*
        popLayout takes the outgoing view out of flow at once, so the box adopts
        the incoming height immediately and layout glides it on collapseTransition.
      */}
      <motion.div
        layout
        transition={reduceMotion ? INSTANT : collapseTransition}
        className={cn('overflow-hidden', !bare && 'px-3 py-2')}
      >
        <AnimatePresence initial={false} mode="popLayout">
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
      </motion.div>
    </div>
  );
};
