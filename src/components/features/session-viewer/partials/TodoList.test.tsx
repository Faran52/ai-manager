import { render, screen } from '@testing-library/react';

import { TodoList } from './TodoList';

test('renders todo statuses and active wording', () => {
  render(
    <TodoList todos={[
      {
        content: 'done',
        status: 'completed',
      },
      {
        content: 'ship',
        status: 'in_progress',
        activeForm: 'shipping',
      },
      {
        content: 'later',
        status: 'pending',
      },
    ]}
    />,
  );

  expect(screen.getByText('done')).toBeDefined();
  expect(screen.getByText('shipping')).toBeDefined();
  expect(screen.getByText('later')).toBeDefined();
});
