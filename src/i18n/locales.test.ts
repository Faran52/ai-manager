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

const sortedKeys = (bundle: Bundle): readonly string[] => {
  return Object.keys(bundle).sort(byText);
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

  test('interpolation placeholders survive translation', () => {
    for (const namespace of namespaces) {
      for (const [key, english] of Object.entries(resources.en[namespace])) {
        const expected = placeholdersIn(english);

        for (const language of languages) {
          const translated = bundleFor(language.id, namespace)[key] ?? '';

          expect(placeholdersIn(translated), `${language.id}/${namespace}/${key}`)
            .toEqual(expected);
        }
      }
    }
  });
});
