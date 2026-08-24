import { render, screen } from '@testing-library/react';
import {
  describe,
  expect,
  test,
} from 'vitest';

import { SystemNotice } from './SystemNotice';

import type { SystemTurnEntry } from '@services/history/historyService';

describe('SystemNotice', () => {
  test('renders the notice text with its timestamp anchor', () => {
    const entry: SystemTurnEntry = {
      kind: 'system',
      uuid: 's1',
      timestamp: '2026-01-01T00:00:00Z',
      sidechain: false,
      level: undefined,
      subtype: undefined,
      text: 'hooks finished',
    };

    render(<SystemNotice entry={entry} />);

    expect(screen.getByText('hooks finished')).toBeDefined();
    expect(document.querySelector('[data-system-notice][data-timestamp="2026-01-01T00:00:00Z"]')).not.toBeNull();
  });
});
