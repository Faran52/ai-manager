import { useTranslation } from 'react-i18next';

import { TruncatedText } from '@ui/index';

import { OutcomeImages } from './OutcomeImages';

import type { ToolOutcome } from '@services/history/historyService';
import type { FC } from 'react';

export interface OutcomeBodyProps {
  readonly outcome: ToolOutcome;
}

export const OutcomeBody: FC<OutcomeBodyProps> = ({ outcome }) => {
  const { t } = useTranslation('session');
  const hasText = outcome.text != null && outcome.text.length > 0;

  if (!hasText && (outcome.stderr == null || outcome.stderr.length === 0)) {
    return outcome.images.length > 0 ? <OutcomeImages outcome={outcome} /> : null;
  }

  return (
    <div className="space-y-2">
      {hasText && <TruncatedText label={t('output')} text={outcome.text} />}
      {outcome.stderr != null && outcome.stderr.length > 0 && (
        <TruncatedText label={t('stderr')} text={outcome.stderr} />
      )}
      {outcome.images.length > 0 && <OutcomeImages outcome={outcome} />}
    </div>
  );
};
