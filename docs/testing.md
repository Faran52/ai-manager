# Test files

Every source file that carries behaviour has a colocated test named after it. This records the
handful that do not, and why, so nobody has to rediscover it.

The standards themselves live in `plugins/linteljs/skills/linteljs/references/testing.md`. This file
only carries the exemptions, which no rule can see.

## Exempt, with reasons

**Barrels.** `index.ts` files re-export and nothing else. A test would assert that an export exists,
which the compiler already refuses to build without.

**Type-only modules.** `contracts.ts`, `history/types.ts` and
`history/utils/claudeRawUtils.ts` declare interfaces and export no runtime value. There is nothing to
call. `claudeRawUtils.ts` is 171 lines and 17 interfaces with zero runtime exports.

**Constant modules.** `config/appConfig.ts`, `config/shortcuts.ts`, `config/storageKeys.ts` and the
three `services/*/constants.ts` are data. A test asserting `pageSize === 120` restates the line above
it and fails for every deliberate edit. The keys in `storageKeys.ts` are imported by the boot script
in `index.astro` rather than repeated in it, so there is no drift to pin either.

**The endpoint table.** `lib/apis/constants.ts` is the twenty-six route definitions and the
one-line response guard beside each. `'projects' in value && Array.isArray(value.projects)` has
nothing a test could assert that is not the line itself, and every guard is already exercised
through the client call that uses it in `apiClient.test.ts`.

**`lib/apis/endpoints.ts`.** A barrel over `lib/apis/utils/*EndpointUtils.ts`, kept under its own
name because the twenty-seven route adapters import it. Same reason as the other barrels.

**API route adapters.** `src/pages/api/*.ts` are eight-line delegates. Their logic lives in
`lib/apis/endpoints.ts`, which has its own test, and their wiring cannot be unit tested here because
**`src/pages/` is the router**: a `*.test.ts` beside a route becomes a route. Adding them made the
build render `/api/agent-setup.test` and fail. If that wiring ever needs pinning it belongs in a
browser runner over `astro build` output, not in Vitest.

**`middleware.ts`.** Four lines delegating to `isForeignOrigin`, which is covered by
`lib/apis/originUtils.test.ts`. Calling `onRequest` directly needs a whole `APIContext`, and the
standard forbids casting one into existence.

## The rule of thumb

If breaking a line in the file can make a test fail, the file gets a test. If the only way to write
one is to fabricate a type or restate a constant, the file is exempt and belongs on the list above.
