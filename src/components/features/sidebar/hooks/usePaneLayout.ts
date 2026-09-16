import { useEffect, useState } from 'react';

import { clamp } from 'es-toolkit';

import {
  projectsDrawerStorageKey,
  projectsPaneStorageKey,
  sessionsListStorageKey,
  sidebarWidthStorageKey,
} from '@config/storageKeys';

import { storedWidth } from '@ui/index';

import type { WidthRange } from '@ui/index';

export interface PaneLayout {
  readonly projectsWidth: number;
  readonly sessionsWidth: number;
  readonly projectsOpen: boolean;
  readonly sessionsOpen: boolean;
  readonly setProjectsOpen: (open: boolean) => void;
  readonly setSessionsOpen: (open: boolean) => void;
  readonly resizeProjects: (delta: number) => void;
  readonly resizeSessions: (delta: number) => void;
}

export const PROJECTS_WIDTH: WidthRange = {
  min: 200,
  max: 480,
  fallback: 260,
};

export const SESSIONS_WIDTH: WidthRange = {
  min: 280,
  max: 520,
  fallback: 320,
};

// The width a column folds to: its strip of marks, w-14 in the tailwind scale.
export const COLLAPSED_WIDTH = '3.5rem';

/*
 * The two sidebar columns' widths and whether each is folded, remembered
 * across launches. A width never leaves its range, whatever the drag asks.
 */
export const usePaneLayout = (): PaneLayout => {
  const [projectsWidth, setProjectsWidth] = useState(() => {
    return storedWidth(projectsPaneStorageKey, PROJECTS_WIDTH);
  });
  const [sessionsWidth, setSessionsWidth] = useState(() => {
    return storedWidth(sidebarWidthStorageKey, SESSIONS_WIDTH);
  });
  const [projectsOpen, setProjectsOpen] = useState(() => {
    return localStorage.getItem(projectsDrawerStorageKey) !== 'false';
  });
  const [sessionsOpen, setSessionsOpen] = useState(() => {
    return localStorage.getItem(sessionsListStorageKey) !== 'false';
  });

  useEffect(() => {
    localStorage.setItem(projectsPaneStorageKey, String(projectsWidth));
    localStorage.setItem(sidebarWidthStorageKey, String(sessionsWidth));
    localStorage.setItem(projectsDrawerStorageKey, String(projectsOpen));
    localStorage.setItem(sessionsListStorageKey, String(sessionsOpen));
  }, [projectsOpen, projectsWidth, sessionsOpen, sessionsWidth]);

  return {
    projectsWidth,
    sessionsWidth,
    projectsOpen,
    sessionsOpen,
    setProjectsOpen,
    setSessionsOpen,
    resizeProjects: (delta) => {
      setProjectsWidth((width) => {
        return clamp(width + delta, PROJECTS_WIDTH.min, PROJECTS_WIDTH.max);
      });
    },
    resizeSessions: (delta) => {
      setSessionsWidth((width) => {
        return clamp(width + delta, SESSIONS_WIDTH.min, SESSIONS_WIDTH.max);
      });
    },
  };
};
