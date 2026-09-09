import {
  describe,
  expect,
  test,
} from 'vitest';

import { parseInjectedContext } from './injectedContextUtils';

const lines = (...parts: readonly string[]): string => {
  return parts.join('\n');
};

describe('parseInjectedContext', () => {
  test('returns undefined when no codex markers are present', () => {
    expect(parseInjectedContext('<system-reminder>be good</system-reminder>')).toBeUndefined();
  });

  test('splits a codex CLI first turn into instructions and environment', () => {
    const text = lines(
      '# AGENTS.md instructions for /repo',
      '',
      '<INSTRUCTIONS>',
      '# Rules',
      '',
      '- one',
      '</INSTRUCTIONS><environment_context>',
      '  <cwd>/repo</cwd>',
      '  <shell>zsh</shell>',
      '  <current_date>2026-08-28</current_date>',
      '  <timezone>Asia/Karachi</timezone>',
      '  <filesystem><root>/repo</root></filesystem>',
      '</environment_context>',
    );

    const parsed = parseInjectedContext(text);

    expect(parsed?.instructions).toBe('# Rules\n\n- one');
    expect(parsed?.environment).toEqual([
      {
        label: 'cwd',
        value: '/repo',
      },
      {
        label: 'shell',
        value: 'zsh',
      },
      {
        label: 'date',
        value: '2026-08-28',
      },
      {
        label: 'timezone',
        value: 'Asia/Karachi',
      },
    ]);
    expect(parsed?.plugins).toBeUndefined();
    expect(parsed?.rest).toBeUndefined();
  });

  test('reads the recommended plugin names without their ids', () => {
    const text = lines(
      '<recommended_plugins>',
      'Here is a list of plugins that are available but not installed.',
      '',
      '- Airtable (airtable@openai-curated-remote)',
      '- Todoist: To Do List & Calendar (app-6943b7@openai-curated-remote)',
      '- Bare',
      '- Kept (v2) beta',
      '</recommended_plugins>',
    );

    expect(parseInjectedContext(text)?.plugins).toEqual([
      'Airtable',
      'Todoist: To Do List & Calendar',
      'Bare',
      'Kept (v2) beta',
    ]);
  });

  test('keeps leftover text after the parsed blocks as rest', () => {
    const parsed = parseInjectedContext(lines(
      '<INSTRUCTIONS>',
      'do the thing',
      '</INSTRUCTIONS>',
      '<user_notes>keep me</user_notes>',
    ));

    expect(parsed?.instructions).toBe('do the thing');
    expect(parsed?.rest).toBe('<user_notes>keep me</user_notes>');
  });

  test('drops an environment block that carries none of the four fields', () => {
    const parsed = parseInjectedContext(
      '<INSTRUCTIONS>x</INSTRUCTIONS><environment_context><shell>zsh</environment_context>',
    );

    expect(parsed?.instructions).toBe('x');
    expect(parsed?.environment).toBeUndefined();
  });

  test('leaves an unclosed environment block untouched', () => {
    const parsed = parseInjectedContext(lines(
      '<environment_context>',
      '  <cwd>/repo</cwd>',
      '<recommended_plugins>',
      '- Airtable (x@y)',
      '</recommended_plugins>',
    ));

    expect(parsed?.plugins).toEqual(['Airtable']);
    expect(parsed?.environment).toBeUndefined();
    expect(parsed?.rest).toContain('<environment_context>');
  });

  test('takes environment fields with no instructions or plugins', () => {
    const parsed = parseInjectedContext('<environment_context><cwd>/only</cwd></environment_context>');

    expect(parsed?.environment).toEqual([{
      label: 'cwd',
      value: '/only',
    }]);
    expect(parsed?.instructions).toBeUndefined();
  });

  test('reads a skill payload body as the instructions', () => {
    const parsed = parseInjectedContext(lines(
      'Base directory for this skill: /repo/plugins/x/skills/x',
      '',
      '# X',
      '',
      '- step one',
    ));

    expect(parsed?.instructions).toBe('# X\n\n- step one');
    expect(parsed?.rest).toBeUndefined();
  });

  test('reads a CLAUDE.md instructions header the same way', () => {
    const parsed = parseInjectedContext('# CLAUDE.md instructions for /repo\n\n# Rules\n\ndo it');

    expect(parsed?.instructions).toBe('# Rules\n\ndo it');
  });

  test('leaves a header that is not at the start in the rest', () => {
    const parsed = parseInjectedContext('<INSTRUCTIONS>real</INSTRUCTIONS>\nBase directory for this skill: /x\n\nnote');

    expect(parsed?.instructions).toBe('real');
    expect(parsed?.rest).toContain('Base directory for this skill');
  });
});
