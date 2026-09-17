// Out of the main process: a 193MB history costs 575ms to parse, and that is
// the loop drawing menus. Started by desktopEntry.ts, which waits for the port.
import { once } from 'node:events';

const { startServer } = await import('../dist/server/entry.mjs');
const listener = startServer().server.server;

await once(listener, 'listening');

const address = listener.address();

if (typeof address !== 'object' || address === null) {
  throw new Error('the app server is listening on no port');
}

process.parentPort.postMessage({ port: address.port });
