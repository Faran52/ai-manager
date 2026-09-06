import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Check,
  ChevronDown,
  Clipboard,
  Download,
  FileCode,
  FileJson,
  FileText,
} from 'lucide-react';

import {
  entriesToHtml,
  entriesToJson,
  entriesToMarkdown,
} from '@services/export/exportService';
import { copyTextToClipboard, saveTextFile } from '@utils/browserFilesUtils';
import { slugOf } from '@utils/slugUtils';

import { Menu, MenuItem } from '@ui/index';

import type { ExportMeta } from '@services/export/exportService';
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
  // Both writers take the same header, so the meta is built once.
  const meta = (): ExportMeta => {
    return {
      title,
      project,
      exportedAtMs: Date.now(),
    };
  };
  const markdown = (): string => {
    return entriesToMarkdown(meta(), entries);
  };

  return (
    <div data-export-menu>
      <Menu
        label={t('export')}
        open={open}
        onOpenChange={(next) => {
          if (next) {
            setCopied(false);
          }

          setOpen(next);
        }}
        trigger={(
          <button type="button" className="toolbar-button">
            <Download className="size-3.5" />
            {t('exportAction')}
            <ChevronDown className="size-3 transition-transform" data-open={open} />
          </button>
        )}
      >
        <MenuItem
          icon={copied
            ? <Check className="size-3.5 text-ok" />
            : <Clipboard className="size-3.5" />}
          onSelect={() => {
            void (async (): Promise<void> => {
              setCopied(await copyTextToClipboard(markdown()));
            })();
          }}
        >
          {copied ? t('copiedMarkdown') : t('copyMarkdown')}
        </MenuItem>
        <MenuItem
          icon={<FileText className="size-3.5" />}
          onSelect={() => {
            saveTextFile(`${slugOf(title)}.md`, markdown(), 'text/markdown');
          }}
        >
          {t('exportMarkdown')}
        </MenuItem>
        <MenuItem
          icon={<FileCode className="size-3.5" />}
          onSelect={() => {
            saveTextFile(`${slugOf(title)}.html`, entriesToHtml(meta(), entries), 'text/html');
          }}
        >
          {t('exportHtml')}
        </MenuItem>
        <MenuItem
          icon={<FileJson className="size-3.5" />}
          onSelect={() => {
            saveTextFile(`${slugOf(title)}.json`, entriesToJson(entries), 'application/json');
          }}
        >
          {t('exportJson')}
        </MenuItem>
      </Menu>
      {copied && <span className="sr-only" role="status">{t('copied', { ns: 'common' })}</span>}
    </div>
  );
};
