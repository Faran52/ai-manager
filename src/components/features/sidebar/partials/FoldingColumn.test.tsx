import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { FoldingColumn } from './FoldingColumn';

test('shows its content while open and its strip once folded', () => {
  const { rerender } = render(
    <FoldingColumn open width={260} className="bg-sidebar" strip={<span>strip</span>}>
      <span>content</span>
    </FoldingColumn>,
  );

  expect(screen.getByText('content')).toBeDefined();
  expect(screen.queryByText('strip')).toBeNull();

  rerender(
    <FoldingColumn open={false} width={260} className="bg-sidebar" strip={<span>strip</span>}>
      <span>content</span>
    </FoldingColumn>,
  );

  expect(screen.getByText('strip')).toBeDefined();
});
