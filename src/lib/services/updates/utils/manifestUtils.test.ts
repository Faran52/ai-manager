import {
  describe,
  expect,
  test,
} from 'vitest';

import { parseUpdateManifest, verifyManifestSignature } from './manifestUtils';

const encodeBase64 = (bytes: Uint8Array): string => {
  return btoa(String.fromCharCode(...bytes));
};

const signingPair = async (): Promise<{ publicKey: string;
  sign: (body: string) => Promise<string>; }> => {
  const pair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const raw = await crypto.subtle.exportKey('raw', pair.publicKey);

  return {
    publicKey: encodeBase64(new Uint8Array(raw)),
    sign: async (body: string): Promise<string> => {
      const signature = await crypto.subtle.sign(
        { name: 'Ed25519' },
        pair.privateKey,
        new TextEncoder().encode(body),
      );

      return encodeBase64(new Uint8Array(signature));
    },
  };
};

const document = JSON.stringify({
  version: '1.2.0',
  notes: 'Faster search',
  artifacts: {
    darwin: {
      name: 'app-1.2.0.zip',
      sha256: 'a'.repeat(64),
    },
    windows: {
      name: 'app-1.2.0.msi',
      sha256: 'b'.repeat(64),
    },
    broken: { name: 'no-hash.zip' },
    scalar: 'nope',
  },
});

describe('parseUpdateManifest', () => {
  test('reads an unsigned feed and drops malformed artifacts', async () => {
    const manifest = await parseUpdateManifest(document);

    expect(manifest?.version).toBe('1.2.0');
    expect(manifest?.notes).toBe('Faster search');
    expect(Object.keys(manifest?.artifacts ?? {})).toEqual(['darwin', 'windows']);
  });

  test('rejects junk, missing versions and non-object feeds', async () => {
    expect(await parseUpdateManifest('not json')).toBeUndefined();
    expect(await parseUpdateManifest('[1,2]')).toBeUndefined();
    expect(await parseUpdateManifest(JSON.stringify({ artifacts: {} }))).toBeUndefined();
    expect(await parseUpdateManifest(JSON.stringify({ version: '1.0.0' }))).toMatchObject({
      artifacts: {},
    });
  });

  test('accepts a correctly signed envelope', async () => {
    const { publicKey, sign } = await signingPair();
    const body = JSON.stringify({
      signed: document,
      signature: await sign(document),
    });
    const manifest = await parseUpdateManifest(body, publicKey);

    expect(manifest?.version).toBe('1.2.0');
  });

  test('refuses a tampered payload, a wrong key and an inner non-object', async () => {
    const { publicKey, sign } = await signingPair();
    const signature = await sign(document);

    expect(await parseUpdateManifest(
      JSON.stringify({
        signed: document.replace('1.2.0', '9.9.9'),
        signature,
      }),
      publicKey,
    )).toBeUndefined();

    expect(await parseUpdateManifest(
      JSON.stringify({
        signed: document,
        signature,
      }),
      'not-a-key',
    )).toBeUndefined();

    const inner = '"just a string"';

    expect(await parseUpdateManifest(
      JSON.stringify({
        signed: inner,
        signature: await sign(inner),
      }),
      publicKey,
    )).toBeUndefined();
  });

  test('refuses an unsigned feed once a key is configured', async () => {
    const { publicKey } = await signingPair();

    expect(await parseUpdateManifest(document, publicKey)).toBeUndefined();
  });

  test('signature check survives a malformed key', async () => {
    expect(await verifyManifestSignature('body', 'sig', '!!!')).toBe(false);
  });
});
