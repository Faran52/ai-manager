import { getViteConfig } from 'astro/config';

import 'vitest/config';

export default getViteConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./__mocks__/setupTests.ts'],
    /*
     * Node 25+ exposes a native `localStorage` that throws without
     * `--localstorage-file`, and happy-dom no longer replaces it, so every
     * storage-backed component test reads `undefined`. Turning the native one
     * off lets happy-dom's shim win. https://github.com/capricorn86/happy-dom/issues/1950
     * Unconditional: engines.node is >=26.8.1, past the version where it matters.
     */
    execArgv: ['--no-experimental-webstorage'],
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
