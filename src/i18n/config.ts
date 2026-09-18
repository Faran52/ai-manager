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

export const directionOf = (language: string): 'ltr' | 'rtl' => {
  return languages.find((option) => {
    return option.id === language;
  })?.dir ?? 'ltr';
};
