import { useTranslation } from 'react-i18next';

import { createArchive } from '@lib/apis/apiClient';
import { saveTextFile } from '@utils/browserFilesUtils';

import { useMutationRunner, useToast } from '@ui/index';

import { exportSessions } from '../utils/bulkExportUtils';

import type { SessionSummary } from '@services/history/historyService';

export interface BulkActions {
  readonly busy: boolean;
  readonly archiveSelected: () => void;
  readonly exportSelected: () => void;
}

/*
 * Both actions add rather than remove, so neither asks for confirmation the
 * way deleting does. Archiving names the exact sessions instead of sweeping
 * everything the agents hold; an export is named for the scope it came from.
 */
export const useBulkActions = (
  selectedSessions: readonly SessionSummary[],
  scopeName: string | undefined,
): BulkActions => {
  const { t } = useTranslation('sidebar');
  const { push: pushToast } = useToast();
  const mutation = useMutationRunner((message) => {
    pushToast(message, 'error');
  });

  const archiveSelected = (): void => {
    void mutation.run(async () => {
      const { archive } = await createArchive({
        note: t('bulkArchiveNote'),
        sessionKeys: selectedSessions.map((session) => {
          return `${session.agent}:${session.actualSessionId}`;
        }),
      });

      pushToast(t('bulkArchived', { count: archive.sessionCount }));
    });
  };

  const exportSelected = (): void => {
    void mutation.run(async () => {
      const result = await exportSessions(selectedSessions, scopeName ?? '', Date.now());

      if (result.markdown.length > 0) {
        saveTextFile(`${scopeName ?? 'sessions'}.md`, result.markdown, 'text/markdown');
      }

      if (result.failed > 0) {
        pushToast(t('bulkExportFailed'), 'error');
      }
    });
  };

  return {
    busy: mutation.busy,
    archiveSelected,
    exportSelected,
  };
};
