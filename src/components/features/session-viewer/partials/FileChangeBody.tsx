import { useTranslation } from 'react-i18next';

import { diffLines } from '@utils/diffUtils';

import { PatchView } from '@ui/index';

import type { ToolCallInput } from '@services/history/historyService';
import type { FC } from 'react';

type FileChange = Extract<ToolCallInput, { kind: 'file-write' | 'file-edit' | 'multi-edit' }>;

export interface FileChangeBodyProps {
  readonly input: FileChange;
}

/**
 * What the agent asked to be changed, shown the way a change is normally read.
 * A written file has nothing before it, so it reads as an addition throughout;
 * an edit reads as the replacement it is. This is the request rather than the
 * result: where an agent recorded the change it actually applied, the card
 * shows that instead.
 */
const changeOf = (input: FileChange): ReturnType<typeof diffLines> => {
  if (input.kind === 'file-write') {
    return diffLines('', input.content);
  }

  if (input.kind === 'file-edit') {
    return diffLines(input.oldString, input.newString);
  }

  return input.edits.flatMap((edit) => {
    return diffLines(edit.oldString, edit.newString);
  });
};

export const FileChangeBody: FC<FileChangeBodyProps> = ({ input }) => {
  const { t } = useTranslation('session');
  const hunks = changeOf(input);

  if (hunks.length === 0) {
    return (
      <p className="text-xs text-muted-foreground" data-file-change-empty>
        {t('noChangeRequested')}
      </p>
    );
  }

  return (
    <div className="grid gap-1" data-file-change>
      <p className="font-mono text-[11px] break-all text-muted-foreground">{input.path}</p>
      <PatchView hunks={hunks} />
    </div>
  );
};
