import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { agentOption } from '@config/agents';

import {
  Button,
  Modal,
  TextInput,
  useLastPresent,
} from '@ui/index';

import type { SessionSummary } from '@services/history/historyService';
import type { FC } from 'react';

export interface RenameSessionDialogProps {
  readonly open: boolean;
  readonly session: SessionSummary | null;
  readonly busy: boolean;
  readonly onClose: () => void;
  readonly onConfirm: (session: SessionSummary, title: string) => void;
}

export const RenameSessionDialog: FC<RenameSessionDialogProps> = ({
  open,
  session,
  busy,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation('sidebar');
  const target = useLastPresent(session);
  const [syncedFrom, setSyncedFrom] = useState<SessionSummary | null>(null);
  const [title, setTitle] = useState('');

  if (target != null && target !== syncedFrom) {
    setSyncedFrom(target);
    setTitle(target.title ?? target.summary ?? target.preview ?? '');
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="rename-session-title" widthClass="max-w-md">
      {target == null
        ? null
        : (
            <form
              className="p-5"
              onSubmit={(event) => {
                event.preventDefault();

                if (title.trim().length > 0) {
                  onConfirm(target, title);
                }
              }}
            >
              <h2 id="rename-session-title" className="text-base font-semibold">
                {`Rename in ${agentOption(target.agent).label}`}
              </h2>
              <div className="mt-4">
                <TextInput value={title} onInput={setTitle} label={t('sessionTitle')} placeholder={t('sessionTitle')} />
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="ghost" disabled={busy} onClick={onClose}>{t('cancel', { ns: 'common' })}</Button>
                <Button type="submit" variant="primary" disabled={busy || title.trim().length === 0}>
                  {busy ? 'Renaming…' : t('rename', { ns: 'common' })}
                </Button>
              </div>
            </form>
          )}
    </Modal>
  );
};
