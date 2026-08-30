export interface LanguageOption {
  readonly dir: 'ltr' | 'rtl';
  readonly id: string;
  readonly label: string;
}

export const languages: readonly LanguageOption[] = [
  {
    id: 'en',
    label: 'English',
    dir: 'ltr',
  },
  {
    id: 'ar',
    label: 'العربية',
    dir: 'rtl',
  },
  {
    id: 'ja',
    label: '日本語',
    dir: 'ltr',
  },
  {
    id: 'ko',
    label: '한국어',
    dir: 'ltr',
  },
  {
    id: 'zh-CN',
    label: '简体中文',
    dir: 'ltr',
  },
  {
    id: 'zh-TW',
    label: '繁體中文',
    dir: 'ltr',
  },
];

export const fallbackLanguage = 'en';

// Not a language, but the absence of a chosen one. Stored as nothing at all, so
// that a reader who never chooses keeps following their system when it changes.
export const systemLanguage = 'system';

// A browser reporting a regional tag like en-GB matches no entry.
export const labelOf = (language: string): string => {
  return languages.find((option) => {
    return option.id === language;
  })?.label ?? '';
};

export const directionOf = (language: string): 'ltr' | 'rtl' => {
  return languages.find((option) => {
    return option.id === language;
  })?.dir ?? 'ltr';
};
