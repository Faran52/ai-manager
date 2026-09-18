import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { reducedMotion } from '@mocks/reducedMotionFixtures';

import { Disclosure } from './Disclosure';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Disclosure', () => {
  test('opens and closes its body on click when uncontrolled', async () => {
    reducedMotion(false);
    render(
      <Disclosure summary="Details">
        <p>hidden body</p>
      </Disclosure>,
    );

    const trigger = screen.getByRole('button', { name: /details/i });

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('hidden body')).toBeNull();

    await userEvent.click(trigger);

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('[data-disclosure][data-state="open"]')).not.toBeNull();
    expect(screen.getByText('hidden body')).toBeDefined();

    await userEvent.click(trigger);

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('hidden body')).toBeNull();
  });

  test('honours defaultOpen', () => {
    reducedMotion(false);
    render(
      <Disclosure summary="Reasoning" defaultOpen>
        <p>already shown</p>
      </Disclosure>,
    );

    expect(screen.getByText('already shown')).toBeDefined();
  });

  test('defers to the parent when controlled', async () => {
    reducedMotion(false);
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <Disclosure summary="Output" open={false} onOpenChange={onOpenChange}>
        <p>controlled body</p>
      </Disclosure>,
    );

    await userEvent.click(screen.getByRole('button'));

    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.queryByText('controlled body')).toBeNull();

    rerender(
      <Disclosure summary="Output" open onOpenChange={onOpenChange}>
        <p>controlled body</p>
      </Disclosure>,
    );

    expect(screen.getByText('controlled body')).toBeDefined();
  });

  test('lands on the end state for a reduced-motion reader', async () => {
    reducedMotion(true);
    render(
      <Disclosure summary="Trace">
        <p>reduced body</p>
      </Disclosure>,
    );

    await userEvent.click(screen.getByRole('button'));

    expect(screen.getByText('reduced body')).toBeDefined();
  });
});
