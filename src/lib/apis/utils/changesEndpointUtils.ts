import { watch } from 'node:fs';

import { CHANGE_DEBOUNCE_MS, HEARTBEAT_MS } from '../constants';

import { resolveEndpointRoots } from './endpointDepsUtils';

import type { FSWatcher } from 'node:fs';
import type { EndpointDeps } from './endpointDepsUtils';

export interface ChangeStreamOptions {
  // Injected by the test, which has no agent directories to watch.
  readonly roots?: readonly string[] | undefined;
  readonly debounceMs?: number | undefined;
  readonly heartbeatMs?: number | undefined;
}

const agentRoots = (deps: EndpointDeps | undefined): readonly string[] => {
  const resolved = resolveEndpointRoots(deps);

  return [...new Set(Object.values(resolved).flat() as readonly string[])];
};

/*
 * One watcher per root, recursive. A root that is not there yet is skipped
 * rather than fatal: an agent the reader has never run has no directory.
 */
const watchRoots = (roots: readonly string[], onChange: () => void): readonly FSWatcher[] => {
  return roots.flatMap((root) => {
    try {
      return [watch(root, { recursive: true }, onChange)];
    }
    catch {
      return [];
    }
  });
};

/**
 * Tells the page when the history on disk moved, so it can reload instead of
 * asking every few seconds whether anything happened.
 *
 * The event carries no payload. What changed is not worth describing when the
 * page already knows how to fetch what it shows, and a path would leak the
 * reader's directory layout into a stream anything on the origin can open.
 */
export const handleChangeStream = (
  request: Request,
  deps?: EndpointDeps,
  options: ChangeStreamOptions = {},
): Response => {
  const roots = options.roots ?? agentRoots(deps);
  const debounceMs = options.debounceMs ?? CHANGE_DEBOUNCE_MS;
  const heartbeatMs = options.heartbeatMs ?? HEARTBEAT_MS;

  let watchers: readonly FSWatcher[] = [];
  let debounce: NodeJS.Timeout | undefined;
  let heartbeat: NodeJS.Timeout | undefined;
  let live = true;

  // Shared by the abort and the reader going away, either of which can be first.
  const release = (): void => {
    live = false;

    clearTimeout(debounce);
    clearInterval(heartbeat);

    for (const watcher of watchers) {
      watcher.close();
    }

    watchers = [];
  };

  const stream = new ReadableStream<Uint8Array>({
    start: (controller) => {
      const encoder = new TextEncoder();

      const send = (line: string): void => {
        try {
          controller.enqueue(encoder.encode(line));
        }
        /* v8 ignore next 3 -- only when the reader goes away mid-write, which release cannot get ahead of */
        catch {
          release();
        }
      };

      /*
       * Writing one session fires a burst of events, and the page reloads the
       * same list for all of them, so the burst is collapsed into one.
       */
      const onChange = (): void => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          send('event: changed\ndata: 1\n\n');
        }, debounceMs);
      };

      watchers = watchRoots(roots, onChange);

      // A comment line, which EventSource ignores. Without it an idle stream
      // looks dead to anything between the page and the server.
      heartbeat = setInterval(() => {
        send(': ping\n\n');
      }, heartbeatMs);

      send('event: ready\ndata: 1\n\n');

      request.signal.addEventListener('abort', () => {
        if (!live) {
          return;
        }

        release();
        controller.close();
      });
    },
    cancel: release,
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      'connection': 'keep-alive',
    },
  });
};
