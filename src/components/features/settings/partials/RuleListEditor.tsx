import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Plus, X } from 'lucide-react';

import { Button, TextInput } from '@ui/index';

import type { FC } from 'react';

export interface RuleListEditorProps {
  readonly label: string;
  readonly hint: string;
  readonly placeholder: string;
  readonly rules: readonly string[];
  readonly onChange: (rules: readonly string[]) => void;
}

export const RuleListEditor: FC<RuleListEditorProps> = ({
  label,
  hint,
  placeholder,
  rules,
  onChange,
}) => {
  const { t } = useTranslation('settings');
  const [draft, setDraft] = useState('');
  const trimmed = draft.trim();
  // The disabled button is the only guard: a blank or duplicate rule cannot reach `add`.
  const canAdd = trimmed.length > 0 && !rules.includes(trimmed);

  const add = (): void => {
    onChange([...rules, trimmed]);
    setDraft('');
  };

  return (
    <section className="grid gap-2" data-rule-list={label}>
      <header className="grid gap-0.5">
        <h4 className="text-xs font-semibold text-foreground">{label}</h4>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </header>
      {rules.length > 0 && (
        <ul className="grid gap-1">
          {rules.map((rule) => {
            return (
              <li
                key={rule}
                className="
                  flex items-center gap-2 rounded-md border border-border
                  bg-background px-2 py-1
                "
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
      <div className="flex items-center gap-2">
        <TextInput
          value={draft}
          onInput={setDraft}
          label={t('addRuleTo', { list: label })}
          placeholder={placeholder}
          className="min-w-0 flex-1"
        />
        <Button size="sm" variant="ghost" disabled={!canAdd} onClick={add}>
          <Plus className="size-3.5" />
          {t('addRule')}
        </Button>
      </div>
    </section>
  );
};
