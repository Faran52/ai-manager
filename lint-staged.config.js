/**
 * Three passes over the staged source files, in the order that fails cheapest first: the banned
 * pattern floor, then eslint with --fix, then a typecheck filtered down to the staged files.
 *
 * The typecheck runs the whole project (there is no correct per-file typecheck once a file has
 * imports) and then keeps only the diagnostics that name a staged file. A pre-existing error
 * elsewhere must not block a commit that did not touch it.
 *
 * `.vue` and `.svelte` are in the same glob rather than one of their own: an SFC is where a Vue
 * or Svelte project's logic lives, and leaving it out meant `as never` inside a `<script setup>`
 * block passed every gate. All three passes read one: the checker scans the script blocks, the
 * eslint layers parse the whole file, and `vue-tsc` / `svelte-check` name the SFC path in a
 * diagnostic the same way `tsc` names a `.ts` one.
 *
 * `stylelint` reads the SFC too, through the `postcss-html` syntax the emitted config sets for
 * those extensions, so a `<style>` block is linted where a project has one.
 */
const config = {
  '*.{ts,tsx,mts,cts,vue,svelte}': (stagedFiles) => {
    const files = stagedFiles.join(' ');

    return [
      `node scripts/checkBannedPatterns.ts ${files}`,
      `eslint ${files} --fix`,
      `node scripts/typecheckStaged.ts ${files}`,
    ];
  },
  '*.{css,scss,vue,svelte}': ['stylelint --fix'],
};

export default config;
