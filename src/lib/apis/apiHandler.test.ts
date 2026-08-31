import {
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import {
  clampLimit,
  clampOffset,
  jsonError,
  jsonOk,
  readJsonObject,
  withJsonErrors,
} from './apiHandler';

interface StreamingRequestInit extends RequestInit {
  readonly duplex: 'half';
}

describe('json helpers', () => {
  test('serialise payloads with json content type', () => {
    const ok = jsonOk({ a: 1 });

    expect(ok.status).toBe(200);
    expect(ok.headers.get('content-type')).toBe('application/json');

    const err = jsonError(418, 'teapot');

    expect(err.status).toBe(418);
    expect(err.headers.get('content-type')).toBe('application/json');
  });
});

describe('readJsonObject', () => {
  test('parses object bodies and rejects everything else', async () => {
    const body = await readJsonObject(new Request('https://x', {
      method: 'POST',
      body: '{"a":1}',
    }));

    expect(body).toEqual({ a: 1 });

    for (const raw of ['', '[1]', 'null', '5', '"s"', '{oops']) {
      const request = new Request('https://x', {
        method: 'POST',
        body: raw,
      });
      const result = await readJsonObject(request);

      expect(result).toBeUndefined();
    }
  });
});

describe('clamps', () => {
  test('limit falls back to the default page size and respects the cap', () => {
    expect(clampLimit(undefined)).toBe(120);
    expect(clampLimit(0)).toBe(1);
    expect(clampLimit(-5)).toBe(1);
    expect(clampLimit(99_999)).toBe(400);
    expect(clampLimit(2.7)).toBe(2);
  });

  test('offset floors at zero and drops fractions', () => {
    expect(clampOffset()).toBe(0);
    expect(clampOffset(-3)).toBe(0);
    expect(clampOffset(4.9)).toBe(4);
  });
});

describe('readJsonObject with a failing stream', () => {
  test('returns undefined when reading the body throws', async () => {
    const stream = new ReadableStream({
      pull: (controller) => {
        controller.error(new Error('pipe broke'));
      },
    });
    const init: StreamingRequestInit = {
      method: 'POST',
      body: stream,
      duplex: 'half',
    };
    const request = new Request('https://x', init);

    await expect(readJsonObject(request)).resolves.toBeUndefined();
  });
});

describe('withJsonErrors', () => {
  test('passes successful responses through', async () => {
    const response = await withJsonErrors((): Promise<Response> => {
      return Promise.resolve(jsonOk({ ok: true }));
    });

    expect(response.status).toBe(200);
  });

  /**
   * The log is half of what this does. A 500 the server could not explain is
   * the one failure where the cause only survives if something wrote it down,
   * so the trace is asserted rather than left to appear in the test output.
   */
  test('converts unexpected throws into the JSON error shape', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {
      return undefined;
    });
    const cause = new Error('surprise');

    const response = await withJsonErrors((): Promise<Response> => {
      return Promise.reject(cause);
    });

    expect(response.status).toBe(500);
    expect(await response.text()).toContain('Unexpected server error.');
    expect(logged).toHaveBeenCalledWith('unhandled api error:', cause);

    logged.mockRestore();
  });
});
