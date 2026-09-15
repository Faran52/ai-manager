import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  expect,
  test,
  vi,
} from 'vitest';

import { SortHead } from './SortHead';

test('reports the sort direction it holds and asks for a sort on a click', async () => {
  const onSort = vi.fn();
  const { rerender } = render(
    <table>
      <thead>
        <tr>
          <SortHead
            sortKey="plugin"
            sort={{
              key: 'version',
              direction: 'asc',
            }}
            onSort={onSort}
          >
            Plugin
          </SortHead>
        </tr>
      </thead>
    </table>,
  );

  const head = screen.getByRole('columnheader', { name: 'Plugin' });

  expect(head.getAttribute('aria-sort')).toBe('none');
  await userEvent.click(screen.getByRole('button', { name: 'Plugin' }));
  expect(onSort).toHaveBeenCalledWith('plugin');

  rerender(
    <table>
      <thead>
        <tr>
          <SortHead
            sortKey="plugin"
            sort={{
              key: 'plugin',
              direction: 'desc',
            }}
            onSort={onSort}
          >
            Plugin
          </SortHead>
        </tr>
      </thead>
    </table>,
  );
  expect(screen.getByRole('columnheader', { name: 'Plugin' }).getAttribute('aria-sort')).toBe('descending');
});
