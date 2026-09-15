import { expect, test } from 'vitest';

import { usageItems } from './usageListUtils';

test('turns ranked tool usage into bar items, ten deep at most', () => {
  const usage = Array.from({ length: 12 }, (_unused, index) => {
    return {
      tool: `tool-${String(index)}`,
      count: 12 - index,
    };
  });

  const items = usageItems(usage);

  expect(items).toHaveLength(10);
  expect(items[0]).toEqual({
    label: 'tool-0',
    value: 12,
  });
});
