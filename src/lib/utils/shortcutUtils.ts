import type { ShortcutSpec } from '@config/shortcuts';

const TYPING_SELECTOR = 'input, textarea, select, [contenteditable]';

// A bare-key shortcut must not fire while composing text. On the event target, not
// document.activeElement: a keydown in a portal arrives before focus settles.
export const isTypingTarget = (target: EventTarget | null): boolean => {
  return target instanceof Element && target.closest(TYPING_SELECTOR) != null;
};

// Meta on macOS, Control everywhere else, so one spec covers both.
export const matchesShortcut = (event: KeyboardEvent, spec: ShortcutSpec): boolean => {
  const wantsModifier = spec.meta === true;

  if (event.altKey || (event.metaKey || event.ctrlKey) !== wantsModifier) {
    return false;
  }

  if (event.shiftKey !== (spec.shift === true)) {
    return false;
  }

  return event.key.toLowerCase() === spec.key.toLowerCase();
};

export const shortcutLabel = (spec: ShortcutSpec, apple: boolean): string => {
  const parts = [
    ...(spec.meta === true ? [apple ? '⌘' : 'Ctrl'] : []),
    ...(spec.shift === true ? [apple ? '⇧' : 'Shift'] : []),
    spec.key.length === 1 ? spec.key.toUpperCase() : spec.key,
  ];

  return parts.join(apple ? '' : '+');
};
