import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

import { FileCode2 } from 'lucide-react';

import { Badge, Eyebrow } from '@ui/index';

import type { ScopeSettings } from '@services/settings/settingsService';
import type { FC } from 'react';

export interface SettingsFilePathProps {
  readonly scope: ScopeSettings;
}

// The file path, above whichever body the scope earns. Both branches showed it,
// and only one of them called it anything.
export const SettingsFilePath: FC<SettingsFilePathProps> = ({ scope }) => {
  const { t } = useTranslation('settings');

  return (
    <div className="flex items-start gap-2 border-b border-border pb-3">
      <FileCode2 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <Eyebrow size="figure" className="pt-0.5">{t('file')}</Eyebrow>
      <span className="grid min-w-0 flex-1 gap-1.5">
        {/* A break opportunity after each slash, so a long path wraps at a
            segment boundary instead of splitting settings.local.json in two. */}
        <span className="font-mono text-body wrap-break-word text-foreground">
          {scope.path.split('/').map((segment, index, segments) => {
            return (
              // The path up to this segment is unique per position, unlike the segment.
              <Fragment key={segments.slice(0, index + 1).join('/')}>
                {segment}
                {index < segments.length - 1 && '/'}
                {index < segments.length - 1 && <wbr />}
              </Fragment>
            );
          })}
        </span>
        {/*
          Under the path, not beside it, so the path keeps the whole row. A
          read-only surface has no Save button, so promising it would be created
          on save was a contradiction: three of the five agents opened on a file
          that said it was about to be written and offered nothing to write it.
        */}
        {!scope.exists && (
          <span>
            <Badge tone="warn">
              {scope.editable === true ? t('willBeCreated') : t('notPresent')}
            </Badge>
          </span>
        )}
      </span>
    </div>
  );
};
