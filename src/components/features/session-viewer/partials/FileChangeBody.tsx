import { useTranslation } from 'react-i18next';

import { PatchView } from '@ui/index';

import { changeOf } from '../utils/toolInputUtils';

import type { FC } from 'react';
import type { FileChange } from '../utils/toolInputUtils';

export interface FileChangeBodyProps {
  readonly input: FileChange;
}

export const FileChangeBody: FC<FileChangeBodyProps> = ({ input }) => {
  const { t } = useTranslation('session');
  const hunks = changeOf(input);

  if (hunks.length === 0) {
    return (
      <p className="text-body text-muted-foreground" data-file-change-empty>
        {t('noChangeRequested')}
      </p>
    );
  }

  return (
    <div className="grid gap-1" data-file-change>
      <p className="font-mono text-body break-all text-muted-foreground">{input.path}</p>
      <PatchView hunks={hunks} />
    </div>
  );
};
