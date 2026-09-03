import { useTranslation } from 'react-i18next';

import { ShieldAlert, ShieldCheck } from 'lucide-react';

import type { ProjectTrust } from '@services/agents/agentsService';
import type { FC } from 'react';

export interface ProjectTrustCardProps {
  readonly trust: ProjectTrust;
}

// Only worth a card when something is off; a trusted, known project needs no announcement.
export const ProjectTrustCard: FC<ProjectTrustCardProps> = ({ trust }) => {
  const { t } = useTranslation('setup');

  if (trust.known && trust.trusted) {
    return null;
  }

  return (
    <section className="
      flex items-start gap-2 rounded-md border border-warn/40 bg-warn/5 p-3
      text-xs
    "
    >
      {trust.known
        ? <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warn" />
        : <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
      <p>{trust.known ? t('trustNeverTrusted') : t('trustNoRecord')}</p>
    </section>
  );
};
