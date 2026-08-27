import { getViteConfig } from 'astro/config';

import 'vitest/config';

export default getViteConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./__mocks__/setupTests.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx,mts,js,jsx,mjs}'],
      exclude: [
        '**/*.test.*',
        '**/*.d.ts',
        'src/**/index.ts',
        'src/typings/**',
        'src/{main,index}.{ts,tsx}',
        'src/pages/**',
        'src/lib/services/history/utils/claudeRawUtils.ts',
        'src/lib/services/history/types.ts',
        'src/lib/apis/contracts.ts',
      ],
      thresholds: {
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100,
      },
    },
  },
});
