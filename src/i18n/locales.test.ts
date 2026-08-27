import {
  describe,
  expect,
  test,
} from 'vitest';

import { languages } from './config';
import { resources } from './index';

type Namespace = keyof typeof resources.en;
type Bundle = Readonly<Record<string, string>>;

const namespaces = Object.keys(resources.en) as readonly Namespace[];

const byText = (left: string, right: string): number => {
  return left.localeCompare(right);
};

const bundleFor = (language: string, namespace: Namespace): Bundle => {
  return resources[language as 'en'][namespace];
};

const baseKey = (key: string): string => {
  return key.replace(/_(zero|one|two|few|many|other)$/u, '');
};

const sortedKeys = (bundle: Bundle): readonly string[] => {
  // Plural suffixes differ by language, Arabic carries six forms where English has two.
  return [...new Set(Object.keys(bundle).map(baseKey))].sort(byText);
};

const placeholdersIn = (value: string): readonly string[] => {
  return [...value.matchAll(/\{\{(\w+)\}\}/gu)].map((match) => {
    return match[1] ?? '';
  }).sort(byText);
};

describe('locale parity', () => {
  test('every language ships every namespace English ships', () => {
    for (const language of languages) {
      expect(Object.keys(resources[language.id as 'en']).sort(byText))
        .toEqual([...namespaces].sort(byText));
    }
  });

  test.each(namespaces)('every language defines the same %s keys', (namespace) => {
    const expected = sortedKeys(resources.en[namespace]);

    for (const language of languages) {
      expect(sortedKeys(bundleFor(language.id, namespace))).toEqual(expected);
    }
  });

  test('no translation is left empty', () => {
    for (const language of languages) {
      for (const namespace of namespaces) {
        for (const [key, value] of Object.entries(bundleFor(language.id, namespace))) {
          expect(value.length, `${language.id}/${namespace}/${key}`).toBeGreaterThan(0);
        }
      }
    }
  });

  // A translation may drop a placeholder, Arabic says "one session" without the
  // numeral. Inventing one is the real bug, it would render a literal brace.
  test('translations never introduce an unknown placeholder', () => {
    for (const namespace of namespaces) {
      for (const language of languages) {
        for (const [key, translated] of Object.entries(bundleFor(language.id, namespace))) {
          const base = baseKey(key);
          const allowed = Object.entries(resources.en[namespace]).flatMap(([englishKey, value]) => {
            return baseKey(englishKey) === base ? placeholdersIn(value) : [];
          });

          for (const placeholder of placeholdersIn(translated)) {
            expect(allowed, `${language.id}/${namespace}/${key}`).toContain(placeholder);
          }
        }
      }
    }
  });
});
