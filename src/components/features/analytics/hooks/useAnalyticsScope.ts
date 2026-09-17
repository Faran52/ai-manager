import { useState } from 'react';

export type Scope = 'global' | 'project';

const scopeFor = (projectKey: string): Scope => {
  return projectKey.length > 0 ? 'project' : 'global';
};

/*
 * A chosen project is a request to see it, on arrival and on every later change.
 * The scope lives outside the view: the machine and one project differ.
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
