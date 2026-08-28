import {
  isTypingTarget,
  matchesShortcut,
  shortcutLabel,
} from './shortcutUtils';

const press = (init: KeyboardEventInit): KeyboardEvent => {
  return new KeyboardEvent('keydown', init);
};

test('matches a bare key only without modifiers', () => {
  expect(matchesShortcut(press({ key: '/' }), { key: '/' })).toBe(true);
  expect(matchesShortcut(press({
    key: '/',
    metaKey: true,
  }), { key: '/' })).toBe(false);
  expect(matchesShortcut(press({
    key: '/',
    altKey: true,
  }), { key: '/' })).toBe(false);
  expect(matchesShortcut(press({
    key: '/',
    shiftKey: true,
  }), { key: '/' })).toBe(false);
  expect(matchesShortcut(press({ key: 'a' }), { key: '/' })).toBe(false);
});

test('accepts either platform modifier and is case insensitive', () => {
  const spec = {
    key: 'm',
    meta: true,
    shift: true,
  };

  expect(matchesShortcut(press({
    key: 'M',
    metaKey: true,
    shiftKey: true,
  }), spec)).toBe(true);
  expect(matchesShortcut(press({
    key: 'm',
    ctrlKey: true,
    shiftKey: true,
  }), spec)).toBe(true);
  expect(matchesShortcut(press({
    key: 'm',
    ctrlKey: true,
  }), spec)).toBe(false);
  expect(matchesShortcut(press({
    key: 'm',
    shiftKey: true,
  }), spec)).toBe(false);
});

test('detects a target the user is typing into', () => {
  const input = document.createElement('input');
  const wrapper = document.createElement('div');
  const nested = document.createElement('span');

  wrapper.setAttribute('contenteditable', 'true');
  wrapper.append(nested);

  expect(isTypingTarget(input)).toBe(true);
  expect(isTypingTarget(nested)).toBe(true);
  expect(isTypingTarget(document.createElement('div'))).toBe(false);
  expect(isTypingTarget(null)).toBe(false);
});

test('writes a label for each platform', () => {
  expect(shortcutLabel({ key: '/' }, true)).toBe('/');
  expect(shortcutLabel({
    key: 'm',
    meta: true,
    shift: true,
  }, true)).toBe('⌘⇧M');
  expect(shortcutLabel({
    key: 'm',
    meta: true,
    shift: true,
  }, false)).toBe('Ctrl+Shift+M');
  expect(shortcutLabel({ key: 'Escape' }, false)).toBe('Escape');
});
