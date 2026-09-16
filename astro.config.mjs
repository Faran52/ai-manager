import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, passthroughImageService } from 'astro/config';

// React Compiler, via @astrojs/react's babel passthrough. Off under Vitest: its memo cache
// leaves a permanently-uncovered branch per component, failing the 100% branch gate.
const reactCompiler = process.env.VITEST === undefined
  ? { babel: { plugins: ['babel-plugin-react-compiler'] } }
  : {};

/*
 * Vite's dev module runner cannot inline CommonJS packages: forcing
 * `ssr.noExternal` makes `astro dev` crash on React's CJS entry
 * (`module is not defined`). Rollup has no such limit, so the desktop
 * bundle only needs the inline pass during `astro build`. (brillout:
 * vite-ssr-noExternal-cjs.)
 */
const command = process.argv[2];
const isSSRBundling = command === 'build' || process.env.VITEST !== undefined;

export default defineConfig({
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  integrations: [react(reactCompiler)],
  /*
   * Nothing here goes through `astro:assets`: every image is either in `public/`
   * or a runtime `<img src>` in a React component. Astro still bundles its
   * default Sharp image service, which drags the native libvips build into the
   * server graph and, from there, into the packaged app. The passthrough
   * service drops Sharp from the graph entirely.
   */
  image: { service: passthroughImageService() },
  vite: {
    plugins: [tailwindcss()],
    /*
     * Bundle every npm dependency into `dist/server` so the packaged app can
     * drop `node_modules` entirely. Vite externalises node_modules in SSR by
     * default, which left `clsx` unresolved at runtime and would put the whole
     * 1.35 GB tree inside the app.
     */
    ssr: isSSRBundling ? { noExternal: true } : {},
    /*
     * The 500 kB default warns about transfer over a network. This bundle is
     * read off local disk by the packaged app, where the client chunk is 1042
     * kB and transfers in 10ms, so splitting it would buy nothing. The limit
     * sits just above that rather than off, so real growth still says so.
     */
    build: { chunkSizeWarningLimit: 1_200 },
  },
});
