import { useTranslation } from 'react-i18next';

import {
  formatClock,
  formatCost,
  formatDateTime,
} from '@utils/formatUtils';

import type { TokenUsage } from '@services/history/historyService';
import type { FC } from 'react';

export interface MessageHeaderProps {
  readonly roleKey: string;
  // The speaker's name when it is more than the bare role: an assistant turn
  // reads by its agent ("Claude Code"), the same mark the avatar carries.
  readonly name?: string | undefined;
  readonly timestamp: string;
  readonly sidechain?: boolean;
  readonly model?: string | undefined;
  readonly usage?: TokenUsage | undefined;
  readonly costUsd?: number | undefined;
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
  name,
  timestamp,
  sidechain = false,
  model,
  usage,
  costUsd,
}) => {
  const { t } = useTranslation('session');
  const timestampMs = Date.parse(timestamp);
  const readable = !Number.isNaN(timestampMs);
  const details = usageTitle(usage, costUsd, (key, count) => {
    return t(key, { count });
  });

  return (
    // A size-6 line box, the height of the avatar beside it, so the name
    // centres on the mark instead of sitting a few pixels above it.
    <div
      className="flex items-baseline gap-2 text-body/6 text-dim"
      data-message-header
    >
      <span className="font-semibold text-foreground-2">{name ?? t(roleKey)}</span>
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
          rounded-full bg-warn/15 px-1.5 py-0.5 font-mono text-figure text-warn
        "
        >
          {t('branch')}
        </span>
      )}
      {model != null && (
        <span
          className="ms-auto truncate font-mono text-figure"
          title={details.length > 0 ? `${model} · ${details}` : model}
          data-message-model
        >
          {shortModel(model)}
        </span>
      )}
    </div>
  );
};
