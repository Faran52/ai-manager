import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  describe,
  expect,
  test,
} from 'vitest';

import { InjectedContextBody } from './InjectedContextBody';

describe('InjectedContextBody', () => {
  test('renders an unrecognised block as one markdown region', () => {
    render(<InjectedContextBody text={'A reminder.\n\n# Heading\n\n- point'} />);

    expect(screen.getByText('Heading').tagName).toBe('H1');
    expect(screen.getByText('point').closest('ul')).not.toBeNull();
    expect(document.querySelector('[data-code-line]')).toBeNull();
  });

  test('unwraps a system-reminder wrapper instead of printing its tags', () => {
    const text = [
      '<system-reminder>',
      'Contents of /repo/CLAUDE.md (project instructions):',
      '',
      '# LintelJS project',
      '',
      '- Follow the rules',
      '</system-reminder>',
    ].join('\n');

    render(<InjectedContextBody text={text} />);

    expect(screen.getByText('LintelJS project').tagName).toBe('H1');
    expect(screen.getByText('Follow the rules')).toBeDefined();
    expect(screen.queryByText(/system-reminder/u)).toBeNull();
  });

  test('unwraps an environment_details block instead of printing its tags', () => {
    const text = [
      '<environment_details>',
      '# Current Mode',
      '',
      'ACT MODE',
      '</environment_details>',
    ].join('\n');

    render(<InjectedContextBody text={text} />);

    expect(screen.getByText('Current Mode').tagName).toBe('H1');
    expect(screen.queryByText(/environment_details/u)).toBeNull();
  });

  test('renders codex instructions as markdown and the environment as rows', () => {
    const text = [
      '<INSTRUCTIONS>',
      '# Project rules',
      '</INSTRUCTIONS><environment_context>',
      '<cwd>/repo</cwd><shell>zsh</shell>',
      '</environment_context>',
    ].join('\n');

    render(<InjectedContextBody text={text} />);

    expect(screen.getByText('Project rules').tagName).toBe('H1');
    expect(screen.getByText('/repo')).toBeDefined();
    expect(screen.getByText('zsh')).toBeDefined();
  });

  test('collapses the recommended plugins behind their count', async () => {
    const text = ['<recommended_plugins>', '- Airtable (a@b)', '- Alpaca (c@d)', '</recommended_plugins>'].join('\n');

    render(<InjectedContextBody text={text} />);

    expect(screen.getByText('2')).toBeDefined();
    expect(screen.queryByText('Airtable')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /Recommended plugins/u }));

    expect(screen.getByText('Airtable')).toBeDefined();
  });

  test('shows leftover text alongside the parsed sections', () => {
    render(<InjectedContextBody text={'<INSTRUCTIONS># Rules</INSTRUCTIONS>\nkept aside'} />);

    expect(screen.getByText('Rules').tagName).toBe('H1');
    expect(screen.getByText('kept aside')).toBeDefined();
  });

  test('renders a skill payload body as markdown', () => {
    const text = ['Base directory for this skill: /repo/skills/x', '', '# Skill X', '', '- rule one'].join('\n');

    render(<InjectedContextBody text={text} />);

    expect(screen.getByText('Skill X').tagName).toBe('H1');
    expect(screen.getByText('rule one')).toBeDefined();
  });
});
