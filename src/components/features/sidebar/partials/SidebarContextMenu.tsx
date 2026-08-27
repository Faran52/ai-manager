import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('sidebar');
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
        label: t('projectActions'),
        title: target.project.name,
        actions: [
          ...(projectPath == null
            ? []
            : [{
                label: t('copyProjectPath'),
                icon: <Folder className="size-3.5" />,
                onSelect: () => {
                  copy(projectPath, t('projectPathCopied'));
                },
              }]),
          {
            label: t('copyProjectId'),
            icon: <Clipboard className="size-3.5" />,
            onSelect: () => {
              copy(target.project.id, t('projectIdCopied'));
            },
          },
          ...(agentOption(target.project.agent).canDeleteProject
            ? [{
                label: t('deleteProjectHistory'),
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
        label: t('sessionActions'),
        title: target.session.title ?? target.session.summary ?? target.session.preview ?? target.session.id,
        actions: [
          {
            label: t('copySessionId'),
            icon: <Clipboard className="size-3.5" />,
            onSelect: () => {
              copy(target.session.actualSessionId, t('sessionIdCopied'));
            },
          },
          ...(resumeCommand == null
            ? []
            : [{
                label: t('copyResumeCommand'),
                icon: <Play className="size-3.5" />,
                onSelect: () => {
                  const resume = `${resumeCommand} ${shellQuote(target.session.actualSessionId)}`;

                  const commandWithCwd = target.session.cwd == null
                    ? resume
                    : `cd ${shellQuote(target.session.cwd)} && ${resume}`;

                  copy(commandWithCwd, t('resumeCommandCopied'));
                },
              }]),
          {
            label: t('copySessionPath'),
            icon: <FileText className="size-3.5" />,
            onSelect: () => {
              copy(target.session.filePath, t('sessionPathCopied'));
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
                label: t('deleteSession'),
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
