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
   * Assistant prose, reasoning and injected instruction bodies are Markdown by
   * nature, so plain sentences among them still parse (inline emphasis, links).
   * Tool output and a typed message stay raw when they carry no Markdown.
   * Either way the Parsed / Raw card appears only when a real Markdown block is
   * present, so a one line answer never grows a toggle.
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
 * The transcript is virtualised, so a card scrolled out of the window unmounts
 * and its toggle would snap back to Parsed on return. Keep the last choice per
 * body text at module scope: no id has to be threaded through the turn
 * components, and two identical blocks sharing a toggle is harmless. Bounded in
 * practice (one transcript's blocks) and cleared on reload.
 * ponytail: plain Map, no eviction. Swap for LruCache if a heap snapshot cares.
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
        popLayout drops the outgoing view to absolute the moment it starts to
        leave, so the box takes the incoming view's height at once rather than
        holding the old one until the fade ends. layout then glides that height
        change on collapseTransition, the bounded-region exception a Disclosure
        already takes, so Raw and Parsed swap without the container snapping.
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
