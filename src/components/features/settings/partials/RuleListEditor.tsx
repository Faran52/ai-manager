import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Plus, X } from 'lucide-react';

import { cn } from '@utils/cnUtils';

import { Button, TextInput } from '@ui/index';

import type { FC } from 'react';

export type RuleTone = 'neutral' | 'allow' | 'deny' | 'ask';

export interface RuleListEditorProps {
  readonly label: string;
  readonly hint: string;
  readonly placeholder: string;
  readonly rules: readonly string[];
  readonly tone?: RuleTone;
  readonly onChange: (rules: readonly string[]) => void;
}

// A denied rule and an allowed one are opposites and used to read identically.
const ROW_TONES: Record<RuleTone, string> = {
  neutral: 'border-border bg-background',
  allow: 'border-ok/30 bg-ok/5',
  deny: 'border-destructive/30 bg-destructive/5',
  ask: 'border-warn/30 bg-warn/5',
};

const MARK_TONES: Record<RuleTone, string> = {
  neutral: 'bg-muted-foreground/40',
  allow: 'bg-ok',
  deny: 'bg-destructive',
  ask: 'bg-warn',
};

export const RuleListEditor: FC<RuleListEditorProps> = ({
  label,
  hint,
  placeholder,
  rules,
  tone = 'neutral',
  onChange,
}) => {
  const { t } = useTranslation(['settings', 'common']);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const trimmed = draft.trim();
  // The disabled button is the only guard: a blank or duplicate rule cannot reach `add`.
  const canAdd = trimmed.length > 0 && !rules.includes(trimmed);

  const close = (): void => {
    setAdding(false);
    setDraft('');
  };

  const add = (): void => {
    if (!canAdd) {
      return;
    }

    onChange([...rules, trimmed]);
    close();
  };

  return (
    <section className="grid gap-2" data-rule-list={label}>
      <header className="grid gap-0.5">
        <h4 className="
          flex items-center gap-1.5 text-xs font-semibold text-foreground
        "
        >
          <span className={cn('size-1.5 shrink-0 rounded-full', MARK_TONES[tone])} />
          <span>{label}</span>
          <span className="
            font-mono text-[10px] font-normal text-muted-foreground
          "
          >
            {rules.length}
          </span>
          {/*
            The field lives behind this, because four lists each holding an
            empty input made the card read as a blank form rather than as what
            the file currently says. Hidden while the field is open, so there is
            never a second Add on screen competing with the one that commits.
          */}
          {!adding && (
            <span className="ms-auto">
              <Button
                size="sm"
                variant="ghost"
                title={t('addRuleTo', { list: label })}
                onClick={() => {
                  setAdding(true);
                }}
              >
                <Plus className="size-3.5" />
                {t('addRule')}
              </Button>
            </span>
          )}
        </h4>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </header>
      {rules.length > 0 && (
        <ul className="grid gap-1">
          {rules.map((rule) => {
            return (
              <li
                key={rule}
                className={cn(
                  'flex items-center gap-2 rounded-md border px-2 py-1',
                  ROW_TONES[tone],
                )}
              >
                <span className="
                  min-w-0 flex-1 truncate font-mono text-[11px] text-foreground
                "
                >
                  {rule}
                </span>
                <button
                  type="button"
                  aria-label={t('removeRule', { rule })}
                  onClick={() => {
                    onChange(rules.filter((entry) => {
                      return entry !== rule;
                    }));
                  }}
                  className="
                    rounded-sm p-0.5 text-muted-foreground
                    hover:bg-accent hover:text-destructive
                  "
                >
                  <X className="size-3" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {adding && (
        <div className="flex items-center gap-2">
          <TextInput
            value={draft}
            onInput={setDraft}
            onEnter={add}
            label={t('addRuleTo', { list: label })}
            placeholder={placeholder}
            className="min-w-0 flex-1"
          />
          <Button size="sm" variant="primary" disabled={!canAdd} onClick={add}>
            {t('addRule')}
          </Button>
          <Button size="sm" variant="ghost" onClick={close}>
            {t('cancel', { ns: 'common' })}
          </Button>
        </div>
      )}
    </section>
  );
};
