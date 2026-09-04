import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Plus, X } from 'lucide-react';

import { Button, TextInput } from '@ui/index';

import type { EnvEntry } from '@services/settings/settingsService';
import type { FC } from 'react';

export interface EnvEditorProps {
  readonly entries: readonly EnvEntry[];
  readonly onChange: (entries: readonly EnvEntry[]) => void;
}

export const EnvEditor: FC<EnvEditorProps> = ({ entries, onChange }) => {
  const { t } = useTranslation(['settings', 'common']);
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [adding, setAdding] = useState(false);
  const trimmed = name.trim();
  // The disabled button is the only guard: a blank or duplicate name cannot reach `add`.
  const canAdd = trimmed.length > 0 && !entries.some((entry) => {
    return entry.name === trimmed;
  });

  const close = (): void => {
    setAdding(false);
    setName('');
    setValue('');
  };

  const add = (): void => {
    if (!canAdd) {
      return;
    }

    onChange([...entries, {
      name: trimmed,
      value,
    }]);
    close();
  };

  return (
    <section className="grid gap-2" data-env-editor>
      <header className="grid gap-0.5">
        <h4 className="
          flex items-center gap-1.5 text-xs font-semibold text-foreground
        "
        >
          <span>{t('envHeading')}</span>
          <span className="
            font-mono text-[10px] font-normal text-muted-foreground
          "
          >
            {entries.length}
          </span>
          {/* Behind Add for the same reason as the rule lists. */}
          {!adding && (
            <span className="ms-auto">
              <Button
                size="sm"
                variant="ghost"
                title={t('addEnvAction')}
                onClick={() => {
                  setAdding(true);
                }}
              >
                <Plus className="size-3.5" />
                {t('addEnv')}
              </Button>
            </span>
          )}
        </h4>
        <p className="text-[11px] text-muted-foreground">{t('envHint')}</p>
      </header>
      {entries.length > 0 && (
        <ul className="grid gap-1">
          {entries.map((entry) => {
            return (
              <li key={entry.name} className="flex items-center gap-2">
                <span className="
                  w-40 shrink-0 truncate font-mono text-[11px] font-medium
                  text-foreground
                "
                >
                  {entry.name}
                </span>
                <TextInput
                  value={entry.value}
                  onInput={(next) => {
                    onChange(entries.map((current) => {
                      return current.name === entry.name
                        ? {
                            name: current.name,
                            value: next,
                          }
                        : current;
                    }));
                  }}
                  label={t('envValueFor', { name: entry.name })}
                  className="min-w-0 flex-1"
                />
                <button
                  type="button"
                  aria-label={t('removeEnv', { name: entry.name })}
                  onClick={() => {
                    onChange(entries.filter((current) => {
                      return current.name !== entry.name;
                    }));
                  }}
                  className="
                    rounded-sm p-1 text-muted-foreground
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
            value={name}
            onInput={setName}
            onEnter={add}
            label={t('envName')}
            placeholder="ANTHROPIC_MODEL"
            className="w-40 shrink-0"
          />
          <TextInput
            value={value}
            onInput={setValue}
            onEnter={add}
            label={t('envValue')}
            placeholder={t('envValuePlaceholder')}
            className="min-w-0 flex-1"
          />
          <Button size="sm" variant="primary" disabled={!canAdd} onClick={add}>
            {t('addEnv')}
          </Button>
          <Button size="sm" variant="ghost" onClick={close}>
            {t('cancel', { ns: 'common' })}
          </Button>
        </div>
      )}
    </section>
  );
};
