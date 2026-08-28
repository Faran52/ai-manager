import { useTranslation } from 'react-i18next';

import {
  ChevronRight,
  FolderClosed,
  MessagesSquare,
} from 'lucide-react';

import { agentOption } from '@config/agents';

import { formatTimeAgo } from '@lib/utils/formatUtils';
import { cn } from '@utils/cnUtils';

import { AgentTag } from '@features/agent-tag';

import type {
  FC,
  KeyboardEvent,
  MouseEvent,
} from 'react';
import type {
  TreeAgent,
  TreeProject,
  TreeSession,
} from '../utils/agentTreeUtils';

export type TreeNode = TreeAgent | TreeProject | TreeSession;

export type TreeLevel = 'agent' | 'project' | 'session';

export interface TreeRowProps {
  readonly node: TreeNode;
  readonly level: TreeLevel;
  readonly expanded: boolean;
  readonly selected: boolean;
  readonly loading: boolean;
  readonly nowMs: number;
  readonly onSelect: () => void;
  readonly onContextMenu: (event: MouseEvent) => void;
  readonly onKeyDown: (event: KeyboardEvent) => void;
}

const ICONS: Record<TreeLevel, FC<{ className?: string }>> = {
  agent: ({ className }) => {
    return <FolderClosed className={className} />;
  },
  project: ({ className }) => {
    return <FolderClosed className={className} />;
  },
  session: ({ className }) => {
    return <MessagesSquare className={className} />;
  },
};

const INDENT_BASE = 12;
const INDENT_STEP = 16;

const getIndent = (level: TreeLevel): number => {
  if (level === 'agent') {
    return INDENT_BASE;
  }
  if (level === 'project') {
    return INDENT_BASE + INDENT_STEP;
  }
  return INDENT_BASE + INDENT_STEP * 2;
};

const hasChildren = (level: TreeLevel): boolean => {
  return level === 'agent' || level === 'project';
};

const isAgentNode = (node: TreeNode): node is TreeAgent => {
  return 'projectCount' in node;
};

const isProjectNode = (node: TreeNode): node is TreeProject => {
  return 'sessionCount' in node && 'lastActivityMs' in node && !('projectCount' in node);
};

const isSessionNode = (node: TreeNode): node is TreeSession => {
  return 'messageCount' in node && 'lastTimestampMs' in node && !('sessionCount' in node);
};

const getLabel = (node: TreeNode, level: TreeLevel): string => {
  if (level === 'agent' && isAgentNode(node)) {
    return agentOption(node.agent).label;
  }
  if (level === 'project' && isProjectNode(node)) {
    return node.name;
  }
  if (level === 'session' && isSessionNode(node)) {
    return node.title ?? node.summary ?? node.preview ?? node.id;
  }
  return '';
};

const getAriaLevel = (level: TreeLevel): number => {
  if (level === 'agent') {
    return 1;
  }
  if (level === 'project') {
    return 2;
  }
  return 3;
};

const getCountString = (
  node: TreeNode,
  level: TreeLevel,
  t: ReturnType<typeof useTranslation>['t'],
): string => {
  if (level === 'agent' && 'projectCount' in node) {
    return t('sessionCount', { count: node.sessionCount });
  }
  if (level === 'project' && 'sessionCount' in node) {
    return t('sessionCount', { count: node.sessionCount });
  }
  if (level === 'session' && 'messageCount' in node) {
    return t('messageCount', { count: node.messageCount });
  }
  return '';
};

const getProjectCountString = (
  node: TreeNode,
  level: TreeLevel,
  t: ReturnType<typeof useTranslation>['t'],
): string => {
  if (level === 'agent' && 'projectCount' in node) {
    return t('projectCount', { count: node.projectCount });
  }
  return '';
};

const getTimeAgoString = (
  node: TreeNode,
  level: TreeLevel,
  nowMs: number,
  language: string,
): string => {
  if (level === 'project' && 'lastActivityMs' in node) {
    return formatTimeAgo(node.lastActivityMs, nowMs, language);
  }
  if (level === 'session' && 'lastTimestampMs' in node) {
    return formatTimeAgo(node.lastTimestampMs, nowMs, language);
  }
  return '';
};

const getMetaString = (
  level: TreeLevel,
  countStr: string,
  projectCountStr: string,
  timeAgoStr: string,
): string => {
  if (level === 'agent') {
    return `${projectCountStr} · ${countStr}`;
  }
  return `${countStr} · ${timeAgoStr}`;
};

export const TreeRow: FC<TreeRowProps> = ({
  node,
  level,
  expanded,
  selected,
  loading,
  nowMs,
  onSelect,
  onContextMenu,
  onKeyDown,
}) => {
  const { t, i18n } = useTranslation('sidebar');
  const language = i18n.language;

  const indent = getIndent(level);
  const hasKids = hasChildren(level);
  const label = getLabel(node, level);
  const ariaLevel = getAriaLevel(level);

  const projectCountStr = getProjectCountString(node, level, t);
  const countStr = getCountString(node, level, t);
  const timeAgoStr = getTimeAgoString(node, level, nowMs, language);
  const meta = getMetaString(level, countStr, projectCountStr, timeAgoStr);

  const Icon = ICONS[level];

  return (
    <div
      role="treeitem"
      aria-level={ariaLevel}
      aria-expanded={hasKids ? expanded : undefined}
      aria-selected={selected}
      style={{ paddingInlineStart: indent }}
      className={cn(
        'tree-row',
        selected && 'bg-primary/15 ring-1 ring-primary/40 ring-inset',
        !selected && 'hover:bg-accent',
        loading && 'opacity-50',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        onContextMenu={onContextMenu}
        onKeyDown={onKeyDown}
        disabled={loading}
        className={cn(
          'tree-row-button flex w-full items-center gap-2',
          hasKids && 'pr-6',
        )}
      >
        {hasKids && (
          <ChevronRight
            className={cn(
              'size-3.5 shrink-0 text-muted-foreground transition-transform',
              expanded && 'rotate-90',
            )}
            aria-hidden
          />
        )}
        {!hasKids && <span className="size-3.5 shrink-0" aria-hidden />}
        <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 truncate text-sm font-medium text-foreground">{label}</span>
        {level === 'project' && <AgentTag agent={node.agent} />}
      </button>
      <span className={cn(
        `
          tree-row-meta absolute inset-e-2 top-1/2 flex -translate-y-1/2
          items-center gap-2 text-[11px] text-muted-foreground
        `,
        hasKids && 'inset-e-8',
      )}
      >
        {meta}
        {loading && (
          <svg
            className="size-3 animate-spin text-primary"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        )}
      </span>
    </div>
  );
};
