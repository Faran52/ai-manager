import {
  Clipboard,
  FileText,
  Folder,
  FolderX,
  Pencil,
  Play,
  Trash2,
} from 'lucide-react';

import { agentOption } from '@config/agents';

import { copyTextToClipboard } from '@utils/browserFilesUtils';
import { shellQuote } from '@utils/shellQuoteUtils';

import { MenuItem, PopupMenu } from '@ui/index';

import type { ProjectSummary, SessionSummary } from '@services/history/historyService';
import type { PopupPosition } from '@ui/index';
import type { FC, ReactNode } from 'react';

interface ProjectMenuTarget {
  readonly kind: 'project';
  readonly project: ProjectSummary;
}

interface SessionMenuTarget {
  readonly kind: 'session';
  readonly session: SessionSummary;
}

export type SidebarMenuTarget = ProjectMenuTarget | SessionMenuTarget;

export interface SidebarContextMenuProps {
  readonly target: SidebarMenuTarget;
  readonly position: PopupPosition;
  readonly onClose: () => void;
  readonly onCopied: (label: string) => void;
  readonly onDeleteProject: (project: ProjectSummary) => void;
  readonly onRenameSession: (session: SessionSummary) => void;
  readonly onDeleteSession: (session: SessionSummary) => void;
}

interface MenuAction {
  readonly icon: ReactNode;
  readonly label: string;
  readonly onSelect: () => void;
}

export const SidebarContextMenu: FC<SidebarContextMenuProps> = ({
  target,
  position,
  onClose,
  onCopied,
  onDeleteProject,
  onRenameSession,
  onDeleteSession,
}) => {
  const projectPath = target.kind === 'project' ? target.project.actualPath : undefined;
  const sessionAgent = target.kind === 'session' ? agentOption(target.session.agent) : undefined;
  const resumeCommand = sessionAgent?.resumeCommand;

  const copy = (value: string, label: string): void => {
    onClose();
    void (async (): Promise<void> => {
      if (await copyTextToClipboard(value)) {
        onCopied(label);
      }
    })();
  };

  const menu = target.kind === 'project'
    ? {
        label: 'Project actions',
        title: target.project.name,
        actions: [
          ...(projectPath == null
            ? []
            : [{
                label: 'Copy project path',
                icon: <Folder className="size-3.5" />,
                onSelect: () => {
                  copy(projectPath, 'Project path copied');
                },
              }]),
          {
            label: 'Copy project ID',
            icon: <Clipboard className="size-3.5" />,
            onSelect: () => {
              copy(target.project.id, 'Project ID copied');
            },
          },
          ...(agentOption(target.project.agent).canDeleteProject
            ? [{
                label: 'Delete project history',
                icon: <FolderX className="size-3.5" />,
                onSelect: () => {
                  onClose();
                  onDeleteProject(target.project);
                },
              }]
            : []),
        ] satisfies readonly MenuAction[],
      }
    : {
        label: 'Session actions',
        title: target.session.title ?? target.session.summary ?? target.session.preview ?? target.session.id,
        actions: [
          {
            label: 'Copy session ID',
            icon: <Clipboard className="size-3.5" />,
            onSelect: () => {
              copy(target.session.actualSessionId, 'Session ID copied');
            },
          },
          ...(resumeCommand == null
            ? []
            : [{
                label: 'Copy resume command',
                icon: <Play className="size-3.5" />,
                onSelect: () => {
                  const resume = `${resumeCommand} ${shellQuote(target.session.actualSessionId)}`;

                  const commandWithCwd = target.session.cwd == null
                    ? resume
                    : `cd ${shellQuote(target.session.cwd)} && ${resume}`;

                  copy(commandWithCwd, 'Resume command copied');
                },
              }]),
          {
            label: 'Copy session file path',
            icon: <FileText className="size-3.5" />,
            onSelect: () => {
              copy(target.session.filePath, 'Session path copied');
            },
          },
          ...(sessionAgent?.canRename === true
            ? [{
                label: `Rename session in ${sessionAgent.label}`,
                icon: <Pencil className="size-3.5" />,
                onSelect: () => {
                  onClose();
                  onRenameSession(target.session);
                },
              }]
            : []),
          ...(sessionAgent?.canDelete === true
            ? [{
                label: 'Delete session',
                icon: <Trash2 className="size-3.5" />,
                onSelect: () => {
                  onClose();
                  onDeleteSession(target.session);
                },
              }]
            : []),
        ] satisfies readonly MenuAction[],
      };

  return (
    <PopupMenu open onClose={onClose} position={position} label={menu.label}>
      <div
        className="
          truncate border-b border-border px-2 py-1.5 text-[11px] font-medium
          text-muted-foreground
        "
        title={menu.title}
      >
        {menu.title}
      </div>
      {menu.actions.map((action) => {
        return (
          <MenuItem
            key={action.label}
            icon={action.icon}
            onClick={() => {
              action.onSelect();
            }}
          >
            {action.label}
          </MenuItem>
        );
      })}
    </PopupMenu>
  );
};
