import { render, screen } from '@testing-library/react';
import {
  expect,
  test,
  vi,
} from 'vitest';

import { PROJECTS_WIDTH } from '../hooks/usePaneLayout';

import { ColumnGap } from './ColumnGap';

test('is a drag handle while the column is open and a spacer once folded', () => {
  const onResize = vi.fn();
  const { container, rerender } = render(
    <ColumnGap resizable label="Resize" value={260} range={PROJECTS_WIDTH} onResize={onResize} />,
  );

  expect(screen.getByRole('slider', { name: 'Resize' })).toBeDefined();

  rerender(
    <ColumnGap resizable={false} label="Resize" value={260} range={PROJECTS_WIDTH} onResize={onResize} />,
  );

  expect(screen.queryByRole('slider')).toBeNull();
  expect(container.querySelector('.w-2')).not.toBeNull();
});
