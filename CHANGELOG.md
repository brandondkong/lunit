# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.0.0] - 2026-04-27

This is a major release. The signature change to `Assert.timeout` is the only
unambiguous source-level break, but the silent no-op fixes below mean tests
that were quietly skipped under 3.0.1 will start running — that's a behavior
change worth flagging before upgrading.

### Breaking changes

-   **`Assert.timeout` is no longer async.** Return type changed from
    `Promise<void>` to `void`. The body was always synchronous (it used
    `awaitStatus()` to block). If you had `await Assert.timeout(...)`, drop
    the `await`.
-   **Non-parameterized tests now run.** `[undefined]` was used as a
    single-iteration sentinel in the runner — but `{ nil }` collapses to an
    empty table in Luau, so any test without `@Each` was silently skipped.
    Switched to `[{}]`. If you had tests passing under 3.0.1 because they
    weren't actually executing, they'll start running (and possibly failing).
-   **Class-level `@Disabled`/`@Skip`/`@Order` now take effect.** Previously
    they registered metadata but the runner ignored it. A `@Disabled` class
    will now skip every test inside; `@Order(n)` on a class controls the
    order classes run in. If you had `@Disabled` on a class expecting tests
    to keep running anyway, remove it.
-   **Default discovery glob expanded.** `TestRunner` and the Lune runner
    now match both `*.test` and `*.spec` filenames. If you had `.spec.ts`
    files in your test root that you didn't intend to register as tests,
    they'll now be picked up. Pass an explicit `globPattern` to opt out.
-   **Printer output format.** Status symbols changed from emoji
    (`✅ ❌ ⏭️`) to single-width characters (`✓ ✗ ↓`); blank-line spacing
    tightened. If you were parsing the output programmatically, update your
    matchers.
-   **`Reporter.getReport` and `Reporter.output`** are typed as arrow
    properties rather than method shorthand. Existing implementations using
    method-shorthand syntax still work; arrow assignments now work too.

### Added

-   **Lune support.** `scripts/lunit.luau` is a standalone runner that
    auto-discovers `*.test.luau` / `*.spec.luau` recursively and exits
    non-zero on failure. Pulls in a runtime shim
    (`scripts/lune-shim.luau`), a minimal Promise (`scripts/promise.luau`,
    ~115 lines vs `@rbxts/promise`'s ~2000), and an ANSI-colored reporter
    (`scripts/lune-reporter.luau`). Roblox path is unchanged.
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
-   **Dogfood test suite.** 58 tests across `assert`, `decorator`, `runner`,
    and `runtime` modules, run on every push.
-   **GitHub Actions CI** — runs the full Lune suite on push/PR.
-   **Rojo project + Roblox entry script** — `default.project.json` plus
    `scripts/run-tests.server.luau` for in-Studio runs.

### Changed

-   **Modular `lib/` layout.** Source reorganized into `lunit/lib/`
    (`assert`, `decorator`, `metadata`, `reporter`, `runner`, `runtime`,
    `shared`).
-   **`TestClassInstance`** relaxed from `Record<string, Callback>` to
    `object` — test classes no longer need an index signature.
-   **Toolchain.** Migrated to pnpm + rokit, ESLint flat config.

### Fixed

-   Lifecycle hook errors no longer dump the verbose `@rbxts/promise`
    Promise.Error trace to the warn channel — the original error value is
    extracted via `.error` when present.

## [3.0.1] - earlier

See git history for releases prior to 4.0.0.
