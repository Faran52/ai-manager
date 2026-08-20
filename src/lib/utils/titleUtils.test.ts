import {
  describe,
  expect,
  test,
} from 'vitest';

import {
  fileURLName,
  humanPreview,
  humanTitle,
} from './titleUtils';

describe('humanTitle', () => {
  test('passes plain text through trimmed', () => {
    expect(humanTitle('  Real question  ')).toBe('Real question');
  });

  test('yields undefined for empty, blank and missing text', () => {
    expect(humanTitle('')).toBeUndefined();
    expect(humanTitle('   ')).toBeUndefined();
    expect(humanTitle(null)).toBeUndefined();
    expect(humanTitle(undefined)).toBeUndefined();
  });

  test('reduces a file URL to its base name', () => {
    expect(humanTitle('file:///Users/dev/Reports/DNCR_Screen.png')).toBe('DNCR_Screen.png');
  });

  test('yields undefined for bare and malformed file URLs', () => {
    expect(humanTitle('file://')).toBeUndefined();
    expect(humanTitle('file://%zz')).toBeUndefined();
  });
});

describe('fileURLName', () => {
  test('reads the base name and survives junk input', () => {
    expect(fileURLName('file:///a/b/c.txt')).toBe('c.txt');
    expect(fileURLName('not-a-url')).toBeUndefined();
  });
});

describe('humanPreview', () => {
  test('collapses whitespace before clamping', () => {
    expect(humanPreview('  a\n\nb\tc  ', 10)).toBe('a b c');
  });

  test('truncates with an ellipsis at the limit', () => {
    expect(humanPreview('abcdefghij', 4)).toBe('abc…');
  });

  test('reduces a file URL preview to its base name', () => {
    expect(humanPreview('file:///x/report.pdf', 40)).toBe('report.pdf');
  });

  test('yields undefined when nothing usable remains', () => {
    expect(humanPreview('', 10)).toBeUndefined();
    expect(humanPreview('   ', 10)).toBeUndefined();
    expect(humanPreview('file://', 10)).toBeUndefined();
  });
});
