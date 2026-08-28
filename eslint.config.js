import { defineConfig } from '@linteljs/eslint-config/define-config';

const config = await defineConfig({
  framework: 'react',
  typescript: true,
  vitest: true,
  astro: true,
  libraries: ['tailwind'],
  tailwindEntryPoint: './src/styles/global.css',
  ignores: ['dist/**', 'coverage/**', '.claude/**', '.agents/**', 'plugins/linteljs/**', '.astro/**'],
  aliases: {
    '@components/*': './src/components/*',
    '@ui/*': './src/components/ui/*',
    '@features/*': './src/components/features/*',
    '@lib/*': './src/lib/*',
    '@store/*': './src/lib/store/*',
    '@utils/*': './src/lib/utils/*',
    '@services/*': './src/lib/services/*',
    '@config/*': './src/config/*',
    '@mocks/*': './__mocks__/*',
  },
  naming: {
    'src/**/*.astro': '!([a-z]*[A-Z]*)',
    'src/!(*.d|*.test|*.spec).ts': 'CAMEL_CASE',
    'src/!(pages)/**/!(*.d|*.test|*.spec).ts': 'CAMEL_CASE',
    'src/**/*.d.ts': '@(+([a-z0-9])*(-+([a-z0-9]))|+([a-z])*([a-zA-Z0-9]))',
    'src/**/*.tsx': '!([a-z]*[A-Z]*)',
  },
  folderNaming: {
    'src/**/': String.raw`@(+([a-z0-9])*(-+([a-z0-9]))|__tests__|\[*\]|\(*\)|{*})`,
  },
});

/*
 * Placement, which the naming rules above cannot see. A component folder holds
 * components; every other module is a named bucket, so the convention stops
 * being prose that rots: constants.ts, utils/*Utils.ts, hooks/use*.ts, or a
 * *Service.ts entry point.
 */
const placement = {
  name: 'ai-chat-manager/component-module-placement',
  files: ['src/components/**/*.ts'],
  ignores: ['src/components/**/*.test.ts'],
  rules: {
    'check-file/filename-naming-convention': [
      'error',
      { 'src/components/**/*.ts': '@(index|constants|*Utils|use*|*Service)' },
      {
        errorMessage:
          'A .ts file under components must be index.ts, constants.ts, *Utils.ts, use*.ts or *Service.ts.',
      },
    ],
    'check-file/folder-match-with-fex': [
      'error',
      {
        'use*.ts': '**/hooks/',
        '*Utils.ts': '**/utils/',
      },
      { errorMessage: 'This file belongs in {{ folderPattern }}, not "{{ targetPath }}".' },
    ],
  },
};

const rules = [...config, placement];

export default rules;
