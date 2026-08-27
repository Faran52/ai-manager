import { isJsonObject, parseJsonContainer } from '@utils/jsonUtils';

import type { JsonObject, JsonValue } from '@utils/jsonUtils';
import type { UpdateArtifact, UpdateManifest } from '../types';

const decodeBase64 = (value: string): Uint8Array<ArrayBuffer> => {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
};

const stringField = (record: JsonObject, key: string): string | undefined => {
  const value = record[key];

  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

const artifactFrom = (value: JsonValue | undefined): UpdateArtifact | undefined => {
  if (!isJsonObject(value)) {
    return undefined;
  }

  const name = stringField(value, 'name');
  const sha256 = stringField(value, 'sha256');

  return name == null || sha256 == null
    ? undefined
    : {
        name,
        sha256,
      };
};

const artifactsFrom = (value: JsonValue | undefined): Record<string, UpdateArtifact> => {
  if (!isJsonObject(value)) {
    return {};
  }

  const artifacts: Record<string, UpdateArtifact> = {};

  for (const [platform, record] of Object.entries(value)) {
    const artifact = artifactFrom(record);

    if (artifact != null) {
      artifacts[platform] = artifact;
    }
  }

  return artifacts;
};

export const verifyManifestSignature = async (
  payload: string,
  signature: string,
  publicKey: string,
): Promise<boolean> => {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      decodeBase64(publicKey),
      { name: 'Ed25519' },
      false,
      ['verify'],
    );

    return await crypto.subtle.verify(
      { name: 'Ed25519' },
      key,
      decodeBase64(signature),
      new TextEncoder().encode(payload),
    );
  }
  catch {
    return false;
  }
};

// A signed feed wraps the real document, an unsigned one is the document.
export const parseUpdateManifest = async (
  body: string,
  publicKey?: string,
): Promise<UpdateManifest | undefined> => {
  const outer = parseJsonContainer(body);

  if (!isJsonObject(outer)) {
    return undefined;
  }

  const signed = stringField(outer, 'signed');
  const signature = stringField(outer, 'signature');
  let document = outer;

  if (signed != null && signature != null) {
    if (publicKey == null || !await verifyManifestSignature(signed, signature, publicKey)) {
      return undefined;
    }

    const inner = parseJsonContainer(signed);

    if (!isJsonObject(inner)) {
      return undefined;
    }

    document = inner;
  }
  else if (publicKey != null) {
    // A key was configured, so an unsigned feed is a downgrade attack.
    return undefined;
  }

  const version = stringField(document, 'version');

  return version == null
    ? undefined
    : {
        version,
        notes: stringField(document, 'notes'),
        artifacts: artifactsFrom(document.artifacts),
      };
};
