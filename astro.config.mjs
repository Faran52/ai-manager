import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// React Compiler, via @astrojs/react's babel passthrough. Off under Vitest: its memo cache
// leaves a permanently-uncovered branch per component, failing the 100% branch gate.
const reactCompiler = process.env.VITEST === undefined
  ? { babel: { plugins: ['babel-plugin-react-compiler'] } }
  : {};

export default defineConfig({
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  integrations: [react(reactCompiler)],
  vite: { plugins: [tailwindcss()] },
});
