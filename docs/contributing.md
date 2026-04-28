---
outline: deep
---

# Contributing

Lunit is a small framework — issues, PRs, and questions all welcome.
This page covers the local development loop and a few conventions to keep
the codebase readable.

## Setting up

You need:

-   **Node 20+** with [pnpm](https://pnpm.io/) (lockfile is `pnpm-lock.yaml`).
-   **[Rokit](https://github.com/rojo-rbx/rokit)** to manage Lune.
    `rokit install` after cloning picks up the version pinned in `rokit.toml`.

```bash
git clone https://github.com/brandon-kong/lunit
cd lunit
pnpm install
rokit install
```

## The development loop

### Build

The TypeScript source lives in `lunit/`; compiled Luau lands in `out/`.

```bash
pnpm run build      # one-shot rbxtsc compile
pnpm run watch      # incremental, on file change
```

### Run the test suite

The framework dogfoods itself. The full suite runs under Lune in
milliseconds:

```bash
pnpm test           # rbxtsc + lune run scripts/lunit.luau
```

That's the same command CI runs on every push. If it passes locally, it
passes in CI.

### Lint and format

```bash
pnpm run lint       # ESLint flat config
pnpm run format     # Prettier
```

## Repository layout

```text
lunit/
  index.ts                    — public exports
  lib/
    assert/                   — Assert object + types
    decorator/                — @Test, @BeforeEach, @Each, ...
    metadata/                 — decorator metadata storage
    reporter/                 — printer (the default summary formatter)
    runner/                   — TestRunner + per-class TestClassRunner
    runtime/                  — isRoblox / isLune helpers
    shared/                   — enums, constants, types
  test/                       — dogfood test suite
  utils/                      — small leaf utilities
out/                          — rbxtsc output (committed for npm publish)
scripts/                      — Lune-side runtime: shim, promise, runner, reporter
docs/                         — VitePress site (this site)
test/                         — sandbox project for verifying the published tarball
```

The `lib/` split mirrors the public namespaces. New decorators go in
`lib/decorator/`; new assertions in `lib/assert/`. New helpers that don't
fit one of those should probably be a new top-level subdirectory.

## Code conventions

Follow what's already in the file. The existing patterns are:

-   **No ambient state.** Decorators read/write metadata stored on the test
    class constructor. The runner threads everything through arguments.
-   **No emojis or comments-as-checklists in source.** Keep comments to
    "why this is non-obvious" or load-bearing context.
-   **Public API additions need a test in `lunit/test/`.** The dogfood
    suite is also the integration test — every PR should leave the same
    `pnpm test` green it found.
-   **Conventional Commits** for commit messages — the format is
    `type(scope): description`. Common types: `feat`, `fix`, `refactor`,
    `docs`, `chore`, `test`, `ci`.

## What goes into a release

`CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com/);
versioning is [SemVer](https://semver.org/). Roughly:

-   **patch** for bug fixes and doc-only changes
-   **minor** for additive features (new decorator, new assertion, new
    runtime helper)
-   **major** for breaking changes — renaming public API, changing default
    behavior, removing a decorator

Each PR that lands a feature or fix should add a CHANGELOG entry under
`[Unreleased]`.

## Common contribution paths

### Adding a decorator

1.  Implement in `lunit/lib/decorator/index.ts` using `createMethodDecorator`
    or `createSharedDecorator` (per the existing pattern).
2.  If the metadata field is new, declare it on `MethodMetadata` or
    `BaseMetadata` in `lunit/lib/shared/types.d.ts`.
3.  Wire the runtime behavior into `lib/runner/class.ts` (or
    `lib/runner/runner.ts` for class-level effects).
4.  Add a test in `lunit/test/decorator.test.ts`.
5.  Document in `docs/guides/decorators.md` and the table in
    `docs/api-reference.md`.

### Adding an assertion

1.  Add the method to `lunit/lib/assert/index.ts` and the type to
    `lunit/lib/assert/types.d.ts`.
2.  Add a test in `lunit/test/assert.test.ts`.
3.  Document in the assertion table in `docs/api-reference.md`.

### Reporting a bug

A reproducible test is the fastest path to a fix. Write one as a `@Test`
in any class, paste the class in the issue, and Lunit becomes its own
debugger.
