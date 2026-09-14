import {
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach,
  expect,
  test,
  vi,
} from 'vitest';

import { AgentInstallSection } from './AgentInstallSection';

const jsonResponse = (body: object | string, status = 200): Response => {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
};

const CHECK_RESPONSE = {
  agents: {
    crush: {
      installed: false,
      command: 'npm install -g @charmland/crush',
    },
    llm: {
      installed: true,
      command: 'pip install -U llm',
    },
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

test('renders nothing while the check is still in flight or has failed', async () => {
  vi.stubGlobal('fetch', vi.fn(() => {
    return Promise.resolve(jsonResponse('nope', 500));
  }));

  const { container } = render(<AgentInstallSection />);

  expect(container.firstChild).toBeNull();

  await waitFor(() => {
    expect(container.firstChild).toBeNull();
  });
});

test('renders nothing when no agent has a verified command', async () => {
  vi.stubGlobal('fetch', vi.fn(() => {
    return Promise.resolve(jsonResponse({ agents: {} }));
  }));

  const { container } = render(<AgentInstallSection />);

  await waitFor(() => {
    expect(container.firstChild).toBeNull();
  });
});

test('lists an installed badge and an install button by status', async () => {
  vi.stubGlobal('fetch', vi.fn(() => {
    return Promise.resolve(jsonResponse(CHECK_RESPONSE));
  }));

  render(<AgentInstallSection />);

  expect(await screen.findByText('Installed')).toBeDefined();
  expect(screen.getByRole('button', { name: /Install/u })).toBeDefined();
  expect(document.querySelector('[data-agent="llm"]')?.textContent).toContain('LLM');
  expect(document.querySelector('[data-agent="crush"]')?.textContent).toContain('Crush');
});

test('shows the exact command and installs on confirm', async () => {
  let checked = 0;

  const fetchSpy = vi.fn((path: string) => {
    if (path.endsWith('/agent-install')) {
      return Promise.resolve(jsonResponse({ ok: true }));
    }

    checked += 1;

    return Promise.resolve(jsonResponse({
      agents: {
        crush: {
          installed: checked > 1,
          command: 'npm install -g @charmland/crush',
        },
      },
    }));
  });

  vi.stubGlobal('fetch', fetchSpy);

  render(<AgentInstallSection />);

  await userEvent.click(await screen.findByRole('button', { name: /Install/u }));

  expect(await screen.findByText('npm install -g @charmland/crush')).toBeDefined();

  await userEvent.click(screen.getByRole('button', { name: 'Install' }));

  await waitFor(() => {
    expect(screen.queryByText('npm install -g @charmland/crush')).toBeNull();
  });
  expect(await screen.findByText('Installed')).toBeDefined();
});

test('cancels without installing', async () => {
  const fetchSpy = vi.fn(() => {
    return Promise.resolve(jsonResponse(CHECK_RESPONSE));
  });

  vi.stubGlobal('fetch', fetchSpy);

  render(<AgentInstallSection />);

  await userEvent.click(await screen.findByRole('button', { name: /Install/u }));
  expect(await screen.findByText('npm install -g @charmland/crush')).toBeDefined();

  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  await waitFor(() => {
    expect(screen.queryByText('npm install -g @charmland/crush')).toBeNull();
  });
  expect(fetchSpy).toHaveBeenCalledTimes(1);
});

test('keeps the dialog open and shows the failure when the install is refused', async () => {
  const fetchSpy = vi.fn((path: string) => {
    return Promise.resolve(path.endsWith('/agent-install')
      ? jsonResponse({ error: 'registry unreachable' }, 502)
      : jsonResponse(CHECK_RESPONSE));
  });

  vi.stubGlobal('fetch', fetchSpy);

  render(<AgentInstallSection />);

  await userEvent.click(await screen.findByRole('button', { name: /Install/u }));
  await userEvent.click(screen.getByRole('button', { name: 'Install' }));

  expect(await screen.findByText('registry unreachable')).toBeDefined();
  expect(screen.getByText('npm install -g @charmland/crush')).toBeDefined();
});
