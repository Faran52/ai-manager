import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  expect,
  test,
  vi,
} from 'vitest';

import { appConfig } from '@config/appConfig';

import { AboutDialog } from './AboutDialog';

import type { ProbeStage } from '@features/updates';

const noop = (): void => {
  return undefined;
};

const renderDialog = (stage: ProbeStage, version?: string): void => {
  render(
    <AboutDialog
      open
      stage={stage}
      version={version}
      onCheck={noop}
      onClose={noop}
    />,
  );
};

const report = (): string => {
  return document.querySelector('[data-about-report]')?.textContent ?? '';
};

test('names the build it is running', () => {
  renderDialog('idle');

  expect(screen.getByText('AI Manager')).toBeDefined();
  expect(screen.getByText(appConfig.version)).toBeDefined();
});

test('keeps the line empty until there is something to report', () => {
  renderDialog('idle');

  expect(report()).toBe('');
});

test('says what the check found', () => {
  renderDialog('upToDate');

  expect(report()).toBe('You are up to date');
});

test('names the version waiting when there is one', () => {
  renderDialog('available', '9.9.9');

  expect(report()).toContain('9.9.9');
});

test('says so rather than going quiet when the check failed', () => {
  renderDialog('failed');

  expect(report()).toBe('Could not check for updates');
});

test('will not ask again while it is still asking', () => {
  renderDialog('checking');

  expect(report()).toBe('Checking…');
  expect(screen.getByText(/Check for Updates/).closest('button')?.disabled).toBe(true);
});

test('asks again when the button is pressed', async () => {
  const onCheck = vi.fn();

  render(
    <AboutDialog
      open
      stage="upToDate"
      version={undefined}
      onCheck={onCheck}
      onClose={noop}
    />,
  );

  await userEvent.click(screen.getByText(/Check for Updates/));

  expect(onCheck).toHaveBeenCalledTimes(1);
});
