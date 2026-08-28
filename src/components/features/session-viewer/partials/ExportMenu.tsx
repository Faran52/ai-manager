import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Check,
  ChevronDown,
  Clipboard,
  Download,
  FileJson,
  FileText,
} from 'lucide-react';

import { entriesToJson, entriesToMarkdown } from '@services/export/exportService';
import { copyTextToClipboard, saveTextFile } from '@utils/browserFilesUtils';
import { slugOf } from '@utils/slugUtils';

import { MenuItem, PopupMenu } from '@ui/index';

import type { HistoryEntry } from '@services/history/historyService';
import type { FC } from 'react';

export interface ExportMenuProps {
  readonly entries: readonly HistoryEntry[];
  readonly project: string;
  readonly title: string;
}

export const ExportMenu: FC<ExportMenuProps> = ({
  entries,
  project,
  title,
}) => {
  const { t } = useTranslation('session');
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const markdown = (): string => {
    return entriesToMarkdown({
      title,
      project,
      exportedAtMs: Date.now(),
    }, entries);
  };
  const close = (): void => {
    setOpen(false);
  };
  const run = (action: () => void): void => {
    action();
    close();
  };

  return (
    <div className="relative" data-export-menu>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setCopied(false);
          setOpen((value) => {
            return !value;
          });
        }}
        className="toolbar-button"
      >
        <Download className="size-3.5" />
        {t('exportAction')}
        <ChevronDown className="size-3 transition-transform" data-open={open} />
      </button>
      <PopupMenu open={open} onClose={close} label={t('export')}>
        <MenuItem
          icon={copied
            ? <Check className="size-3.5 text-ok" />
            : <Clipboard className="size-3.5" />}
          onClick={() => {
            void (async (): Promise<void> => {
              const copiedOk = await copyTextToClipboard(markdown());

              setCopied(copiedOk);
              close();
            })();
          }}
        >
          {copied ? t('copiedMarkdown') : t('copyMarkdown')}
        </MenuItem>
        <MenuItem
          icon={<FileText className="size-3.5" />}
          onClick={() => {
            run(() => {
              saveTextFile(`${slugOf(title)}.md`, markdown(), 'text/markdown');
            });
          }}
        >
          {t('exportMarkdown')}
        </MenuItem>
        <MenuItem
          icon={<FileJson className="size-3.5" />}
          onClick={() => {
            run(() => {
              saveTextFile(`${slugOf(title)}.json`, entriesToJson(entries), 'application/json');
            });
          }}
        >
          {t('exportJson')}
        </MenuItem>
      </PopupMenu>
      {copied && <span className="sr-only" role="status">{t('copied', { ns: 'common' })}</span>}
    </div>
  );
};
