import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { SetupGroup } from './SetupGroup';

test('labels its values, in the warning tone when asked', () => {
  const { rerender } = render(
    <dl>
      <SetupGroup label="MCP">
        <span>filesystem</span>
      </SetupGroup>
    </dl>,
  );

  expect(screen.getByText('MCP').tagName).toBe('DT');
  expect(screen.getByText('filesystem')).toBeDefined();
  expect(screen.getByText('MCP').classList.contains('text-muted-foreground')).toBe(true);

  rerender(
    <dl>
      <SetupGroup label="Issues" tone="warn">
        <span>missing key</span>
      </SetupGroup>
    </dl>,
  );
  expect(screen.getByText('Issues').classList.contains('text-warn')).toBe(true);
});
