import { expect, test } from 'vitest';

import { hourSlots } from './rhythmSlotUtils';

test('labels every hour with a zero-padded tick', () => {
  const slots = hourSlots([3, 0, 7]);

  expect(slots.map((slot) => {
    return slot.tick;
  })).toEqual(['00', '01', '02']);
  expect(slots[2]).toEqual({
    key: '2',
    label: '2:00',
    tick: '02',
    count: 7,
  });
});
