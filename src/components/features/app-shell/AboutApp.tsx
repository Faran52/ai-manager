import { initI18n } from '@i18n/index';

import { useUpdateProbe } from '@features/updates';

import { AboutPanel } from './partials/AboutPanel';

import type { FC } from 'react';

initI18n();

/*
 * The whole of the About window. It shares nothing with the main window, which
 * is the point: a second window is a second JavaScript context, so this reads
 * the version out of the build and asks the feed itself.
 */
export const AboutApp: FC = () => {
  const probe = useUpdateProbe();

  return (
    <main
      className="
        grid h-dvh place-items-center bg-background px-6 pt-2 pb-6
        text-foreground
      "
      data-about-window
    >
      <AboutPanel stage={probe.stage} version={probe.version} onCheck={probe.check} />
    </main>
  );
};
