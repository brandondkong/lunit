# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.1.0] - 2026-04-27

### Added

-   **Lune support.** `scripts/lunit.luau` is a standalone runner that
    auto-discovers `*.test.luau` recursively and exits non-zero on failure.
    Pulls in a runtime shim (`scripts/lune-shim.luau`), a minimal Promise
    (`scripts/promise.luau`, ~115 lines vs `@rbxts/promise`'s ~2000), and an
    ANSI-colored reporter (`scripts/lune-reporter.luau`). Roblox path is
    unchanged.
-   **`TestRunner.fromClasses(classes)`** and chainable `addClass(ctor)` —
    explicit class registration for environments without a DataModel.
-   **`Runtime.isRoblox()` / `Runtime.isLune()`** for gating tests by host.
    Pair with `@Skip`, e.g. `@Skip(!Runtime.isRoblox(), "Roblox only")`.
-   **`@Retry(count)`** — re-runs a failing test up to `count` extra times.
-   **`@Repeat(count)`** — runs a test `count` times; any failed iteration fails
    the test.
-   **`@Each(rows)`** — parameterized tests. Each row becomes its own
    invocation with a labeled case suffix (`addition (1, 2, 3)`).
-   **`@Only`** — focus mode at the method or class level.
-   **Path-annotated diffs** for `Assert.deepEqual` — failure messages include
    the exact path of every mismatch.
-   **Expanded `Assert` API.** New: `notEqual`, `notDeepEqual`, `between`,
    `approximately`, `notEmpty`, `doesNotContain`, `match`, `startsWith`,
    `endsWith`, `doesNotThrow`, `fail`, `notUndefined`. Assertion messages can
    now also be lazy functions.
-   **Reporter `output` hook** — override how the final report is emitted. Used
    by the colored Lune reporter; lets consumers swap in custom sinks.
-   **`TestCaseResult.label` / `caseIndex` / `caseArgs`** for richer reporter
    integrations.
-   **Dogfood test suite.** 52 tests across `assert`, `decorator`, `runner`, and
    `runtime` modules, run on every push.
-   **GitHub Actions CI** — runs the full Lune suite on push/PR.
-   **Rojo project + Roblox entry script** — `default.project.json` plus
    `scripts/run-tests.server.luau` for in-Studio runs.

### Changed

-   **Modular `lib/` layout.** Source reorganized into `lunit/lib/`
    (`assert`, `decorator`, `metadata`, `reporter`, `runner`, `runtime`,
    `shared`).
-   **Printer.** Single-width symbols (`✓ ✗ ↓`) replace emoji (`✅ ❌ ⏭️`);
    redundant blank lines and double newlines removed.
-   **`TestClassInstance`** relaxed from `Record<string, Callback>` to
    `object` — test classes no longer need an index signature.
-   **Toolchain.** Migrated to pnpm + rokit, ESLint flat config.

### Fixed

-   **Non-parameterized tests silently never ran.** `[undefined]` as a
    single-iteration sentinel in `runTests` compiles to `{ nil }` in Luau,
    which collapses to an empty table. Switched to `[{}]`.

## [3.0.1] - earlier

See git history for releases prior to 3.1.0.
