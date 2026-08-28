import { useTranslation } from 'react-i18next';

import { cn } from '@utils/cnUtils';
import {
  formatClock,
  formatCost,
  formatDateTime,
} from '@utils/formatUtils';

import type { TokenUsage } from '@services/history/historyService';
import type { FC } from 'react';

export interface MessageHeaderProps {
  readonly roleKey: string;
  readonly timestamp: string;
  readonly sidechain?: boolean;
  readonly model?: string | undefined;
  readonly usage?: TokenUsage | undefined;
  readonly costUsd?: number | undefined;
  readonly align?: 'start' | 'end';
}

// The full model id is long enough to crowd the row, and the family is the part being scanned for.
const shortModel = (model: string): string => {
  return model.slice(Math.max(model.lastIndexOf('/'), model.lastIndexOf(':')) + 1);
};

const usageTitle = (
  usage: TokenUsage | undefined,
  costUsd: number | undefined,
  label: (key: string, count: number) => string,
): string => {
  if (usage == null) {
    return '';
  }

  return [
    label('inTokens', usage.inputTokens),
    label('outTokens', usage.outputTokens),
    usage.cacheReadTokens > 0 ? label('cachedTokens', usage.cacheReadTokens) : '',
    costUsd != null && costUsd > 0 ? formatCost(costUsd) : '',
  ].filter((part) => {
    return part.length > 0;
  }).join(' · ');
};

export const MessageHeader: FC<MessageHeaderProps> = ({
  roleKey,
  timestamp,
  sidechain = false,
  model,
  usage,
  costUsd,
  align = 'start',
}) => {
  const { t } = useTranslation('session');
  const timestampMs = Date.parse(timestamp);
  const readable = !Number.isNaN(timestampMs);
  const details = usageTitle(usage, costUsd, (key, count) => {
    return t(key, { count });
  });

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 text-[11px] text-muted-foreground',
        align === 'end' ? 'justify-end' : 'justify-start',
      )}
      data-message-header
    >
      <span className="font-medium">{t(roleKey)}</span>
      {readable && (
        <>
          <span aria-hidden="true">·</span>
          <time dateTime={timestamp} title={formatDateTime(timestampMs)}>
            {formatClock(timestampMs)}
          </time>
        </>
      )}
      {sidechain && (
        <span className="
          rounded-full bg-warn/15 px-1.5 py-0.5 font-mono text-[10px] text-warn
        "
        >
          {t('branch')}
        </span>
      )}
      {model != null && (
        <span
          className="ms-auto truncate font-mono text-[10px]"
          title={details.length > 0 ? `${model} · ${details}` : model}
          data-message-model
        >
          {shortModel(model)}
        </span>
      )}
    </div>
  );
};
