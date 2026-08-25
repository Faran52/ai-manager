import { TriangleAlert } from 'lucide-react';

import type { SetupFinding } from '@services/agents/agentsService';
import type { FC } from 'react';

export interface SetupFindingsProps {
  readonly findings: readonly SetupFinding[];
}

export const SetupFindings: FC<SetupFindingsProps> = ({ findings }) => {
  if (findings.length === 0) {
    return null;
  }

  return (
    <section className="rounded-md border border-warn/40 bg-warn/5 p-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-warn">
        <TriangleAlert className="size-4" />
        {`${String(findings.length)} setup ${findings.length === 1 ? 'problem' : 'problems'}`}
      </h3>
      <ul className="mt-2 grid gap-1 text-xs">
        {findings.map((finding) => {
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
};
