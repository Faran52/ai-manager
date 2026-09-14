import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Check, Download } from 'lucide-react';

import { agentOption, isAgentId } from '@config/agents';

import {
  Badge,
  Button,
  ConfirmDialog,
  Spinner,
} from '@ui/index';

import { useAgentInstalls } from '../hooks/useAgentInstalls';

import type { AgentId } from '@config/agents';
import type { FC } from 'react';

/*
 * Installed-ness is a fact about this machine, not the selected project, so
 * this renders unconditionally in the Health tab rather than behind the
 * projectSelected gate AgentSetupPanel's own rows sit behind.
 */
export const AgentInstallSection: FC = () => {
  const { t } = useTranslation('setup');
  const {
    agents,
    checkError,
    installingAgent,
    installError,
    install,
  } = useAgentInstalls();
  const [confirming, setConfirming] = useState<AgentId | null>(null);

  // Nothing worth a whole section for: still checking, the check failed, or
  // (in principle, if a future build verified none) there is nothing to list.
  if (agents == null || checkError != null) {
    return null;
  }

  const ids = Object.keys(agents).filter(isAgentId);

  if (ids.length === 0) {
    return null;
  }

  const confirmingStatus = confirming == null ? undefined : agents[confirming];

  const confirmInstall = async (): Promise<void> => {
    const agent = confirming;

    // The dialog only mounts a clickable confirm button once open, which only
    // happens once confirming is set, so this never actually fires null.
    /* v8 ignore next 3 */
    if (agent == null) {
      return;
    }

    if (await install(agent)) {
      setConfirming(null);
    }
  };

  return (
    <section className="mb-4" data-health-group="agent-install">
      <h3 className="
        px-1 pb-1 text-body font-semibold tracking-wider text-muted-foreground
        uppercase
      "
      >
        {t('installAgentsTitle')}
      </h3>
      <ul className="grid gap-1 px-1">
        {ids.map((agent) => {
          const status = agents[agent];

          /* v8 ignore next 3 -- ids is built from agents' own keys */
          if (status == null) {
            return null;
          }

          return (
            <li
              key={agent}
              data-agent={agent}
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <span className="min-w-0 flex-1 truncate">{agentOption(agent).label}</span>
              {status.installed
                ? (
                    <Badge tone="success">
                      <Check className="size-3" />
                      {t('agentInstalled')}
                    </Badge>
                  )
                : (
                    <Button
                      size="sm"
                      disabled={installingAgent === agent}
                      onClick={() => {
                        setConfirming(agent);
                      }}
                    >
                      {installingAgent === agent
                        ? <Spinner />
                        : (
                            <Download className="size-3" />
                          )}
                      {installingAgent === agent ? t('installing') : t('install')}
                    </Button>
                  )}
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        open={confirmingStatus != null}
        icon={<Download className="size-4" />}
        heading={t('confirmInstallHeading', { agent: confirming == null ? '' : agentOption(confirming).label })}
        description={confirmingStatus == null
          ? null
          : (
              <div className="mt-2 text-sm">
                <p className="text-muted-foreground">{t('confirmInstallBody')}</p>
                <code className="
                  mt-2 block rounded-sm bg-muted px-2 py-1 font-mono text-xs
                "
                >
                  {confirmingStatus.command}
                </code>
                {/* Shown here too, not just in the background list: this is
                    where the reader is actually looking when it happens. */}
                {installError != null && <p className="mt-2 text-warn">{installError}</p>}
              </div>
            )}
        confirmLabel={t('install')}
        busyLabel={t('installing')}
        busy={confirming != null && installingAgent === confirming}
        onClose={() => {
          setConfirming(null);
        }}
        onConfirm={() => {
          void confirmInstall();
        }}
      />
    </section>
  );
};
