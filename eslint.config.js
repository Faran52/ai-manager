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

export default config;
