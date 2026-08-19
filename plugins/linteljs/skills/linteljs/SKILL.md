---
name: linteljs
description: Apply this project's LintelJS structure, type-safety, testing, and verification standards to every coding task.
---

# LintelJS

- Read `references/repo-structure.md` before adding, moving, or renaming files.
- Read `references/type-standards.md` before editing typed source. Also read `references/type-standards-zod.md` when it exists and the work touches schemas or API code.
- Before changing state, read each emitted framework state reference in `references/`.
- Read `references/testing.md` before editing tests, mocks, or test setup.
- Read `package.json` for exact scripts and dependency versions.
- Treat hooks as guardrails, not a security sandbox, and review every command before running it.
- Run the package-manager `check` command before declaring implementation work complete.
- Run the package-manager `lint:fix` command, not lint without fixes.
- Never use `git stash`, `git reset`, `--no-verify`, `--amend`, `git add -A`, or `git add .`.
- Commit messages carry no `Co-Authored-By` or tool-attribution trailers.
