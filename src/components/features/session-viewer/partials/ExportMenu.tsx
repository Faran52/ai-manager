import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  FileCode,
  FileJson,
  FileText,
  MoreHorizontal,
} from 'lucide-react';

import {
  entriesToHtml,
  entriesToJson,
  entriesToMarkdown,
} from '@services/export/exportService';
import { saveTextFile } from '@utils/browserFilesUtils';
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

/*
 * The command bar's overflow: the transcript exports that are not the one-click
 * copy sitting promoted beside it. A downloaded file per format.
 */
export const ExportMenu: FC<ExportMenuProps> = ({
  entries,
  project,
  title,
}) => {
  const { t } = useTranslation('session');
  const [open, setOpen] = useState(false);
  // Both writers take the same header, so the meta is built once per action.
  const meta = (): ExportMeta => {
    return {
      title,
      project,
      exportedAtMs: Date.now(),
    };
  };

  return (
    <div data-export-menu>
      <Menu
        align="end"
        label={t('export')}
        open={open}
        onOpenChange={setOpen}
        trigger={(
          <button type="button" className="command-action" aria-label={t('export')}>
            <MoreHorizontal className="size-3.5" />
          </button>
        )}
      >
        <MenuItem
          icon={<FileText className="size-3.5" />}
          onSelect={() => {
            saveTextFile(`${slugOf(title)}.md`, entriesToMarkdown(meta(), entries), 'text/markdown');
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
    </div>
  );
};
