import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, passthroughImageService } from 'astro/config';

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
  /*
   * Nothing here goes through `astro:assets`: every image is either in `public/`
   * or a runtime `<img src>` in a React component. Astro still bundles its
   * default Sharp image service, and `deno desktop` then follows Sharp's
   * per-platform `require("@img/sharp-<platform>/sharp.node")` switch and embeds
   * the native libvips build for all sixteen targets, ~1.3 GB, into the desktop
   * binary. The passthrough service drops Sharp from the graph entirely.
   */
  image: { service: passthroughImageService() },
  vite: {
    plugins: [tailwindcss()],
    /*
     * Bundle every npm dependency into `dist/server` so the desktop build can
     * drop `node_modules` entirely (`deno desktop --exclude ./node_modules`).
     * Vite externalises node_modules in SSR by default, which left `clsx`
     * unresolved at runtime and forced the whole 1.35 GB tree into the binary.
     */
    ssr: { noExternal: true },
    define: {
      'import.meta.env.UPDATE_FEED_URL': bakedEnv('UPDATE_FEED_URL'),
      'import.meta.env.UPDATE_PUBLIC_KEY': bakedEnv('UPDATE_PUBLIC_KEY'),
    },
  },
});
