import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Check, Clipboard } from 'lucide-react';

import { entriesToMarkdown } from '@services/export/exportService';
import { copyTextToClipboard } from '@utils/browserFilesUtils';

import type { HistoryEntry } from '@services/history/historyService';
import type { FC } from 'react';

export interface CopyTranscriptButtonProps {
  readonly entries: readonly HistoryEntry[];
  readonly project: string;
  readonly title: string;
}

/*
 * The most-used export, promoted out of the overflow to one click. Keyed on the
 * open file by the caller, so the confirmed state resets with the transcript.
 */
export const CopyTranscriptButton: FC<CopyTranscriptButtonProps> = ({
  entries,
  project,
  title,
}) => {
  const { t } = useTranslation('session');
  const [copied, setCopied] = useState(false);

  return (
    <>
      <button
        type="button"
        className="command-action"
        onClick={() => {
          void (async (): Promise<void> => {
            const markdown = entriesToMarkdown(
              {
                title,
                project,
                exportedAtMs: Date.now(),
              },
              entries,
            );

            setCopied(await copyTextToClipboard(markdown));
          })();
        }}
      >
        {copied
          ? <Check className="size-3.5 text-ok" />
          : <Clipboard className="size-3.5" />}
        {copied ? t('copiedMarkdown') : t('copyMarkdown')}
      </button>
      {copied && <span className="sr-only" role="status">{t('copied', { ns: 'common' })}</span>}
    </>
  );
};
