import { useTranslation } from 'react-i18next';

import { formatTimeAgo, sizeLabel } from '@utils/formatUtils';

import { ATTRIBUTE_LABELS } from '../utils/boardUtils';

import type { SessionSummary } from '@services/history/historyService';
import type { FC } from 'react';
import type { BoardAttribute, BoardModel } from '../utils/boardUtils';

export interface SessionGridProps {
  readonly model: BoardModel;
  readonly attribute: BoardAttribute;
  readonly nowMs: number;
  readonly onOpenSession: (session: SessionSummary) => void;
}

const valueLabel = (value: number, attribute: BoardAttribute, nowMs: number): string => {
  switch (attribute) {
    case 'size':
      return sizeLabel(value);
    case 'duration':
      return `${String(Math.round(value / 60_000))}m`;
    case 'recency':
      return formatTimeAgo(nowMs - value, nowMs);
    case 'messages':
      return String(value);
  }
};

const titleOf = (session: SessionSummary): string => {
  return session.title ?? session.summary ?? session.preview ?? session.id;
};

export const SessionGrid: FC<SessionGridProps> = ({
  model,
  attribute,
  nowMs,
  onOpenSession,
}) => {
  const { t } = useTranslation('board');

  return (
    <ul
      className="flex flex-wrap gap-1"
      aria-label={t('sessionGrid', { measure: t(ATTRIBUTE_LABELS[attribute]).toLowerCase() })}
      data-session-grid
    >
      {model.cells.map((cell) => {
        return (
          <li key={cell.session.filePath}>
            <button
              type="button"
              title={`${titleOf(cell.session)} · ${valueLabel(cell.value, attribute, nowMs)}`}
              aria-label={`${titleOf(cell.session)}, ${valueLabel(cell.value, attribute, nowMs)}`}
              data-intensity={Math.round(cell.intensity * 4)}
              onClick={() => {
                onOpenSession(cell.session);
              }}
              className="
                size-5 rounded-[3px] bg-primary transition-transform
                outline-none
                hover:scale-125
                focus-visible:ring-2 focus-visible:ring-ring
              "
              style={{ opacity: 0.2 + cell.intensity * 0.8 }}
            />
          </li>
        );
      })}
    </ul>
  );
};
