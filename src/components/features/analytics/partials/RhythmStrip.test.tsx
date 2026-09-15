import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { RhythmStrip } from './RhythmStrip';

test('scales every bar to the busiest slot and keeps a hairline for an empty one', () => {
  render(
    <RhythmStrip
      caption="By hour"
      slots={[
        {
          key: '0',
          label: '00:00',
          tick: '0',
          count: 0,
        },
        {
          key: '1',
          label: '01:00',
          tick: '1',
          count: 5,
        },
        {
          key: '2',
          label: '02:00',
          tick: '2',
          count: 10,
        },
      ]}
    />,
  );

  expect(screen.getByRole('img', { name: 'By hour' })).toBeDefined();
  expect(document.querySelector('[data-rhythm-bar="0"]')?.getAttribute('data-rhythm-height')).toBe('0');
  expect(document.querySelector('[data-rhythm-bar="1"]')?.getAttribute('data-rhythm-height')).toBe('50');
  expect(document.querySelector('[data-rhythm-bar="2"]')?.getAttribute('data-rhythm-peak')).toBe('true');
});
