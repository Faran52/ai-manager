import type { SearchHit } from '@services/search/searchService';

export interface HitGroup {
  readonly filePath: string;
  readonly sessionId: string;
  readonly first: SearchHit;
  readonly hits: readonly SearchHit[];
}

// Groups hits by their session file, preserving the order the search returned them in.
interface MutableHitGroup {
  readonly filePath: string;
  readonly sessionId: string;
  readonly first: SearchHit;
  readonly hits: SearchHit[];
}

export const groupBySession = (hits: readonly SearchHit[]): readonly HitGroup[] => {
  const groups = new Map<string, MutableHitGroup>();

  for (const hit of hits) {
    const existing = groups.get(hit.filePath);

    if (existing == null) {
      groups.set(hit.filePath, {
        filePath: hit.filePath,
        sessionId: hit.sessionId,
        first: hit,
        hits: [hit],
      });

      continue;
    }

    existing.hits.push(hit);
  }

  return [...groups.values()];
};
