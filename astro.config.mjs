import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// React Compiler, via @astrojs/react's babel passthrough. Off under Vitest: its memo cache
// leaves a permanently-uncovered branch per component, failing the 100% branch gate.
const reactCompiler = process.env.VITEST === undefined
  ? { babel: { plugins: ['babel-plugin-react-compiler'] } }
  : {};

/**
 * The release feed and its public key, inlined into the bundle at build time.
 *
 * A packaged app runs with the user's environment rather than the one that
 * built it, so leaving these to `process.env` alone ships every release with
 * update checking off. CI passes them in as variables; locally they come from
 * `.env`, which Node reads itself here because `vite` is not a direct
 * dependency. Only these two names are inlined, so the rest of `.env` stays out
 * of the bundle.
 */
try {
  process.loadEnvFile();
}
catch {
  // No .env, which is the normal case in CI.
}

const bakedEnv = (name) => {
  return JSON.stringify(process.env[name] ?? '');
};

export default defineConfig({
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  integrations: [react(reactCompiler)],
  vite: {
    plugins: [tailwindcss()],
    define: {
      'import.meta.env.UPDATE_FEED_URL': bakedEnv('UPDATE_FEED_URL'),
      'import.meta.env.UPDATE_PUBLIC_KEY': bakedEnv('UPDATE_PUBLIC_KEY'),
    },
  },
});
