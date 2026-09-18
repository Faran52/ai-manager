import { useTranslation } from 'react-i18next';

import { appConfig } from '@config/appConfig';

import { cn } from '@utils/cnUtils';

import { Button } from '@ui/index';

import { versionLine } from '../utils/aboutUtils';

import type { ProbeStage } from '@features/updates';
import type { FC } from 'react';

export interface AboutPanelProps {
  readonly stage: ProbeStage;
  readonly version: string | undefined;
  // Absent in a browser, where there is no installed build to replace.
  readonly onCheck?: (() => void)
    | undefined;
}

/*
 * What the app says about itself: a dialog where the app draws its own chrome, a
 * window where the platform does, so it carries neither surface nor padding.
 */
export const AboutPanel: FC<AboutPanelProps> = ({
  stage,
  version,
  onCheck,
}) => {
  const { t } = useTranslation('common');
  const { t: tUpdate } = useTranslation('update');

  const report: Record<ProbeStage, string> = {
    idle: '',
    checking: tUpdate('checking'),
    upToDate: tUpdate('upToDate'),
    available: tUpdate('available', { version }),
    unpublished: tUpdate('upToDate'),
    downloading: tUpdate('downloading'),
    failed: tUpdate('checkFailed'),
  };

  const built = versionLine(t('version', { version: appConfig.version }), appConfig.buildCommit);

  return (
    <div className="mx-auto grid w-full max-w-60 justify-items-center gap-4" data-about-dialog>
      {/* Decorative: the name below says the same thing, in words. */}
      <img
        alt=""
        src="/icon-180.png"
        className="size-16 rounded-[22%] shadow-lg shadow-black/30"
      />

      <div className="grid gap-0.5 text-center">
        <h2 className="text-metric font-semibold tracking-tight text-foreground">AI Manager</h2>
        {/* A literal out of the build, so mono, like every other figure. */}
        <p className="font-mono text-figure text-muted-foreground" data-about-version>
          {built}
        </p>
      </div>

      {onCheck != null && (
        <div className="grid w-full gap-1.5">
          <Button
            variant="subtle"
            size="sm"
            disabled={stage === 'checking'}
            onClick={onCheck}
            data-about-check
          >
            {t('checkUpdates')}
          </Button>

          {/* Held open rather than conditional, so an answer does not shift the
              button out from under the cursor that just pressed it. Being
              current is silence; only the failure takes a colour. */}
          <p
            data-about-report
            className={cn(
              'min-h-4 text-center text-body',
              stage === 'failed' ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {report[stage]}
          </p>
        </div>
      )}
    </div>
  );
};
