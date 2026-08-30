import { useState } from 'react';

export type Scope = 'global' | 'project';

const scopeFor = (projectKey: string): Scope => {
  return projectKey.length > 0 ? 'project' : 'global';
};

/**
 * A chosen project is a request to see that project, both on arriving here and
 * on choosing a different one afterwards. Left to itself the view stayed on the
 * global report and only the scope button's label changed, which reads as the
 * analytics ignoring the choice. Asking for the whole machine still holds until
 * the project changes again.
 *
 * The scope lives outside the view because what is worth fetching depends on
 * it: the whole machine and one project are answered by different requests.
 */
export const useAnalyticsScope = (projectKey: string): {
  readonly scope: Scope;
  readonly setScope: (next: Scope) => void;
} => {
  const [scope, setScope] = useState<Scope>(() => {
    return scopeFor(projectKey);
  });
  const [shownProject, setShownProject] = useState(projectKey);

  if (projectKey !== shownProject) {
    setShownProject(projectKey);
    setScope(scopeFor(projectKey));
  }

  return {
    scope,
    setScope,
  };
};
