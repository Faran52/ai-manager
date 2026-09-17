import { watch } from 'node:fs';

import { decodeReference } from '@services/history/utils/sqliteUtils';
import { containedIn } from '@utils/pathUtils';

import {
  BAD_REQUEST,
  CHANGE_DEBOUNCE_MS,
  HEARTBEAT_MS,
} from '../constants';

import { resolveEndpointRoots } from './endpointDepsUtils';

import type { FSWatcher } from 'node:fs';
import type { EndpointDeps } from './endpointDepsUtils';

const agentRoots = (deps: EndpointDeps | undefined): readonly string[] => {
  return [...new Set(Object.values(resolveEndpointRoots(deps)).flat() as readonly string[])];
};

// A transcript is its own file. A session in a database is that database plus
// the WAL sidecar, which is where a write lands until a checkpoint.
const watchTargets = (filePath: string): readonly [string, ...string[]] => {
  const reference = decodeReference(filePath);

  return reference == null
    ? [filePath]
    : [reference.databasePath, `${reference.databasePath}-wal`];
};

/**
 * Tells the page when the conversation it has open grew, and nothing else.
 *
 * Watching the agent roots instead would be thousands of directories, one
 * inotify entry each on Linux, and a main process callback for every write by
 * every agent. Lists are read once and refreshed by hand.
 */
export const handleChangeStream = async (
  request: Request,
  deps?: EndpointDeps,
): Promise<Response> => {
  const filePath = new URL(request.url).searchParams.get('file');

  if (filePath == null || filePath.length === 0) {
    return new Response(null, { status: BAD_REQUEST });
  }

  const targets = watchTargets(filePath);

  // The page names the file, so the name is checked: unchecked, this watches
  // any path on the machine and reports back what it finds.
  if (!await containedIn(agentRoots(deps), targets[0])) {
    return new Response(null, { status: BAD_REQUEST });
  }

  let watchers: readonly FSWatcher[] = [];
  let debounce: NodeJS.Timeout | undefined;
  let heartbeat: NodeJS.Timeout | undefined;
  let live = true;

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

      // An agent writes a turn in pieces, and each one refetches the same tail.
      const announce = (): void => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          send('event: changed\ndata: 1\n\n');
        }, CHANGE_DEBOUNCE_MS);
        debounce.unref();
      };

      watchers = targets.flatMap((target) => {
        try {
          return [watch(target, announce)];
        }
        catch {
          // A sidecar that is not there, which is the usual case.
          return [];
        }
      });

      // A comment line, which EventSource ignores. An idle stream otherwise
      // looks dead to whatever sits between page and server.
      heartbeat = setInterval(() => {
        send(': ping\n\n');
      }, HEARTBEAT_MS);
      heartbeat.unref();

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
