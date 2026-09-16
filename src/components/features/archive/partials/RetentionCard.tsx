import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Loader2, ShieldCheck } from 'lucide-react';

import { runRetention, writeRetention } from '@lib/apis/apiClient';
import { sessionLabel } from '@services/history/historyService';
import { formatTimeAgo } from '@utils/formatUtils';

import {
  Button,
  Notice,
  Panel,
  Switch,
  TextInput,
  useMutationRunner,
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
  const mutation = useMutationRunner();
  const [showDue, setShowDue] = useState(false);
  const status = retention.data;
  const reload = retention.reload;
  const days = draftDays ?? String(status?.policy.olderThanDays ?? '');
  const parsedDays = Number(days);
  const validDays = Number.isInteger(parsedDays) && parsedDays >= MIN_DAYS && parsedDays <= MAX_DAYS;

  if (status == null) {
    return (
      <Notice>{retention.error}</Notice>
    );
  }

  const save = (enabled: boolean, olderThanDays: number): void => {
    void mutation.run(async () => {
      await writeRetention({
        policy: {
          enabled,
          olderThanDays,
          agents: status.policy.agents,
        },
      });
      setDraftDays(undefined);
      reload();
    });
  };

  const archiveNow = (): void => {
    void mutation.run(async () => {
      await runRetention();
      reload();
    });
  };

  const due = status.due.sessions;

  return (
    <Panel className="grid gap-3">
      {/* The state of the rule is a switch on the trailing edge of its own card,
          not the bare word "Off" sitting in the middle of a sentence. */}
      <header className="flex items-center gap-2">
        <ShieldCheck className="size-4 shrink-0 text-primary" />
        <h3 className="flex-1 text-ui font-semibold text-foreground">{t('retentionHeading')}</h3>
        <Switch
          checked={status.policy.enabled}
          disabled={mutation.busy}
          label={t('retentionHeading')}
          onChange={(enabled) => {
            save(enabled, status.policy.olderThanDays);
          }}
        />
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          {t('retentionOlderThan')}
          <TextInput
            value={days}
            onInput={setDraftDays}
            label={t('retentionDays')}
            className="w-20"
            disabled={mutation.busy}
          />
          {t('retentionDaysUnit')}
        </label>

        <Button
          size="sm"
          variant="ghost"
          disabled={mutation.busy || !validDays || parsedDays === status.policy.olderThanDays}
          onClick={() => {
            save(status.policy.enabled, parsedDays);
          }}
        >
          {t('retentionSave')}
        </Button>
      </div>

      {/* The guarantee belongs beside the one control on this screen that acts
          on its own, not in a page intro nobody reads twice. */}
      <p className="text-body text-muted-foreground" data-retention-guarantee>
        {t('retentionIntro')}
      </p>

      {!validDays && (
        <p className="text-body text-warn" data-retention-invalid>
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
          disabled={mutation.busy || due.length === 0}
          onClick={archiveNow}
        >
          {mutation.busy && <Loader2 className="size-3.5 animate-spin" />}
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
                  text-body text-muted-foreground
                "
              >
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {sessionLabel(session)}
                </span>
                <span>{formatTimeAgo(session.lastTimestampMs, nowMs, i18n.language)}</span>
              </li>
            );
          })}
          {due.length > PREVIEW_ROWS && (
            <li className="px-2 py-1 text-body text-muted-foreground">
              {t('retentionMore', { count: due.length - PREVIEW_ROWS })}
            </li>
          )}
        </ul>
      )}

      {mutation.error.length > 0 && (
        <Notice>{mutation.error}</Notice>
      )}
    </Panel>
  );
};
