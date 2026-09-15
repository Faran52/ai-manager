import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { SettingRow } from './SettingRow';

test('names the control and explains it only when there is a hint', () => {
  const { rerender } = render(
    <SettingRow label="Theme" hint="Follows the system by default">
      <button type="button">Pick</button>
    </SettingRow>,
  );

  expect(screen.getByText('Theme')).toBeDefined();
  expect(screen.getByText('Follows the system by default')).toBeDefined();
  expect(screen.getByRole('button', { name: 'Pick' })).toBeDefined();

  rerender(
    <SettingRow label="Theme">
      <button type="button">Pick</button>
    </SettingRow>,
  );
  expect(screen.queryByText('Follows the system by default')).toBeNull();
});
