import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  CircleAlert,
  Loader2,
  ShieldCheck,
} from 'lucide-react';

import { runRetention, writeRetention } from '@lib/apis/apiClient';
import { toErrorMessage } from '@utils/errorUtils';
import { formatTimeAgo } from '@utils/formatUtils';

import {
  Button,
  Spinner,
  TextInput,
} from '@ui/index';

import type { AsyncResource } from '@features/history-data';
import type { RetentionStatusResponse } from '@lib/apis/contracts';
import type { FC } from 'react';

export interface RetentionCardProps {
  readonly retention: AsyncResource<RetentionStatusResponse>;
  readonly nowMs: number;
}

const MIN_DAYS = 1;
const MAX_DAYS = 3_650;
const PREVIEW_ROWS = 8;

export const RetentionCard: FC<RetentionCardProps> = ({ retention, nowMs }) => {
  const { t, i18n } = useTranslation('archive');
  const [draftDays, setDraftDays] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [showDue, setShowDue] = useState(false);
  const status = retention.data;
  const reload = retention.reload;
  const days = draftDays ?? String(status?.policy.olderThanDays ?? '');
  const parsedDays = Number(days);
  const validDays = Number.isInteger(parsedDays) && parsedDays >= MIN_DAYS && parsedDays <= MAX_DAYS;

  if (retention.status === 'loading') {
    return <Spinner />;
  }

  if (status == null) {
    return (
      <p className="
        flex items-center gap-2 rounded-lg border border-destructive/40
        bg-destructive/10 px-3 py-2 text-xs text-destructive
      "
      >
        <CircleAlert className="size-3.5" />
        {retention.error}
      </p>
    );
  }

  const save = (enabled: boolean, olderThanDays: number): void => {
    setBusy(true);
    setError(undefined);
    void (async (): Promise<void> => {
      try {
        await writeRetention({
          policy: {
            enabled,
            olderThanDays,
            agents: status.policy.agents,
          },
        });
        setDraftDays(undefined);
        reload();
      }
      catch (cause) {
        setError(toErrorMessage(cause));
      }
      finally {
        setBusy(false);
      }
    })();
  };

  const archiveNow = (): void => {
    setBusy(true);
    setError(undefined);
    void (async (): Promise<void> => {
      try {
        await runRetention();
        reload();
      }
      catch (cause) {
        setError(toErrorMessage(cause));
      }
      finally {
        setBusy(false);
      }
    })();
  };

  const due = status.due.sessions;

  return (
    <section
      className="grid gap-3 rounded-xl border border-border bg-card p-4"
      data-retention-card
    >
      <header className="flex items-start gap-2">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="grid gap-0.5">
          <h3 className="text-sm font-semibold text-foreground">{t('retentionHeading')}</h3>
          <p className="text-xs text-muted-foreground">{t('retentionIntro')}</p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={status.policy.enabled ? 'primary' : 'ghost'}
          pressed={status.policy.enabled}
          disabled={busy}
          onClick={() => {
            save(!status.policy.enabled, status.policy.olderThanDays);
          }}
        >
          {status.policy.enabled ? t('retentionOn') : t('retentionOff')}
        </Button>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          {t('retentionOlderThan')}
          <TextInput
            value={days}
            onInput={setDraftDays}
            label={t('retentionDays')}
            className="w-20"
            disabled={busy}
          />
          {t('retentionDaysUnit')}
        </label>

        <Button
          size="sm"
          variant="ghost"
          disabled={busy || !validDays || parsedDays === status.policy.olderThanDays}
          onClick={() => {
            save(status.policy.enabled, parsedDays);
          }}
        >
          {t('retentionSave')}
        </Button>
      </div>

      {!validDays && (
        <p className="text-[11px] text-warn" data-retention-invalid>
          {t('retentionDaysInvalid', {
            min: MIN_DAYS,
            max: MAX_DAYS,
          })}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground" data-retention-due>
          {t('retentionDue', { count: due.length })}
        </span>
        {due.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setShowDue((current) => {
                return !current;
              });
            }}
          >
            {showDue ? t('retentionHidePreview') : t('retentionShowPreview')}
          </Button>
        )}
        <Button
          size="sm"
          variant="primary"
          disabled={busy || due.length === 0}
          onClick={archiveNow}
        >
          {busy && <Loader2 className="size-3.5 animate-spin" />}
          {t('retentionRunNow')}
        </Button>
      </div>

      {showDue && (
        <ul className="grid gap-0.5" data-retention-preview>
          {due.slice(0, PREVIEW_ROWS).map((session) => {
            return (
              <li
                key={session.filePath}
                className="
                  flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1
                  text-[11px] text-muted-foreground
                "
              >
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {session.title ?? session.summary ?? session.preview ?? session.id}
                </span>
                <span>{formatTimeAgo(session.lastTimestampMs, nowMs, i18n.language)}</span>
              </li>
            );
          })}
          {due.length > PREVIEW_ROWS && (
            <li className="px-2 py-1 text-[11px] text-muted-foreground">
              {t('retentionMore', { count: due.length - PREVIEW_ROWS })}
            </li>
          )}
        </ul>
      )}

      {error != null && (
        <p className="
          flex items-center gap-2 rounded-lg border border-destructive/40
          bg-destructive/10 px-3 py-2 text-xs text-destructive
        "
        >
          <CircleAlert className="size-3.5" />
          {error}
        </p>
      )}
    </section>
  );
};
