import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { appMenuEvent, isAppCommand } from '@config/appCommands';

import { applicationMenu } from '../utils/appMenuUtils';

import type { AppCommand } from '@config/appCommands';

/*
 * Windows draws no global menu bar, so the app keeps the gear in its own
 * titlebar there, which is where Claude Desktop and WebStorm put it. macOS and
 * the Linux desktops that lift a window menu into their panel get the real one.
 */
const WINDOWED_PLATFORM = 'windows';

const install = async (
  bindings: DesktopBindings,
  items: readonly Deno.MenuItem[],
  signal: AbortSignal,
  onInstalled: () => void,
): Promise<void> => {
  const platform = await bindings.desktopPlatform();

  if (platform === WINDOWED_PLATFORM) {
    return;
  }

  await bindings.setApplicationMenu(items);

  if (!signal.aborted) {
    onInstalled();
  }
};

/*
 * Hands the running window a menu in the reader's language and runs whatever it
 * reports back. Returns whether that menu is up, so the rail can drop the
 * control it now duplicates. Always false in a browser, where there is no
 * window to hand anything to.
 */
export const useNativeMenu = (run: (command: AppCommand) => void): boolean => {
  const { t } = useTranslation('common');
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onCommand = (event: CustomEvent<string>): void => {
      if (isAppCommand(event.detail)) {
        run(event.detail);
      }
    };

    window.addEventListener(appMenuEvent, onCommand);

    return () => {
      window.removeEventListener(appMenuEvent, onCommand);
    };
  }, [run]);

  useEffect(() => {
    const { bindings } = window;

    if (bindings == null) {
      return undefined;
    }

    const controller = new AbortController();

    void install(bindings, applicationMenu(t), controller.signal, () => {
      setInstalled(true);
    });

    return () => {
      controller.abort();
    };
  }, [t]);

  return installed;
};
