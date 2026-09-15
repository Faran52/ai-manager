import { render } from '@testing-library/react';
import { expect, test } from 'vitest';

import { LeadMark } from './LeadMark';

test('carries the agent mark outside selection and a checkbox inside it', () => {
  const { container, rerender } = render(
    <LeadMark agent="claude" selecting={false} checked={false} reduceMotion={false} />,
  );

  expect(container.querySelector('[data-agent="claude"]')).not.toBeNull();
  expect(container.querySelector('.sidebar-check')).toBeNull();

  rerender(<LeadMark agent="claude" selecting checked reduceMotion />);

  expect(container.querySelector('.sidebar-check[data-checked="true"]')).not.toBeNull();
});
