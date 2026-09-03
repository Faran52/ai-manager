import { useTranslation } from 'react-i18next';

import { TriangleAlert } from 'lucide-react';

import { agentOption } from '@config/agents';

import type { AgentId } from '@config/agents';
import type { SetupFinding } from '@services/agents/agentsService';
import type { FC } from 'react';

export interface SetupFindingsProps {
  readonly findings: readonly SetupFinding[];
}

// Findings arrive from every managed agent, so an ungrouped list makes the
// reader match each row back to an agent by reading its detail string.
const byAgent = (
  findings: readonly SetupFinding[],
): readonly (readonly [AgentId, readonly SetupFinding[]])[] => {
  const groups = new Map<AgentId, SetupFinding[]>();

  findings.forEach((finding) => {
    const group = groups.get(finding.agent);

    if (group == null) {
      groups.set(finding.agent, [finding]);

      return;
    }

    group.push(finding);
  });

  return [...groups];
};

export const SetupFindings: FC<SetupFindingsProps> = ({ findings }) => {
  const { t } = useTranslation('setup');

  if (findings.length === 0) {
    return null;
  }

  return (
    <section className="rounded-md border border-warn/40 bg-warn/5 p-3" data-setup-findings>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-warn">
        <TriangleAlert className="size-4" />
        {t('findingsCount', { count: findings.length })}
      </h3>
      <div className="mt-2 grid gap-2">
        {byAgent(findings).map(([agent, group]) => {
          return (
            <section key={agent} data-finding-group={agent}>
              <h4 className="
                text-[11px] font-semibold tracking-wider text-muted-foreground
                uppercase
              "
              >
                {agentOption(agent).label}
              </h4>
              <ul className="mt-1 grid gap-1 text-xs">
                {group.map((finding) => {
                  return (
                    <li
                      key={`${finding.kind}-${finding.detail}`}
                      className="flex flex-wrap gap-2"
                    >
                      <span>{finding.summary}</span>
                      <span className="font-mono text-muted-foreground">{finding.detail}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </section>
  );
};
