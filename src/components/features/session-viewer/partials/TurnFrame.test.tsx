import { render, screen } from '@testing-library/react';
import {
  describe,
  expect,
  test,
} from 'vitest';

import { TurnFrame } from './TurnFrame';

describe('TurnFrame', () => {
  test('marks an assistant turn with the agent circle', () => {
    render(<TurnFrame speaker="assistant" agent="claude">reply</TurnFrame>);

    const mark = screen.getByText('CC');

    expect(mark.getAttribute('data-agent')).toBe('claude');
    expect(screen.getByText('reply')).toBeDefined();
    expect(document.querySelector('[data-turn-frame="assistant"]')).not.toBeNull();
  });

  test('marks a user turn without the agent circle', () => {
    render(<TurnFrame speaker="user" agent="claude">question</TurnFrame>);

    expect(screen.getByText('question')).toBeDefined();
    expect(document.querySelector('[data-turn-frame="user"]')).not.toBeNull();
    expect(screen.queryByText('CC')).toBeNull();
  });

  test('drops the mark on a continued turn', () => {
    render(
      <TurnFrame speaker="assistant" agent="claude" continued>
        more
      </TurnFrame>,
    );

    expect(screen.getByText('more')).toBeDefined();
    expect(screen.queryByText('CC')).toBeNull();
  });
});
