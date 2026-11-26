# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **`lunit` command.** `npx lunit` (or `lunit` in a `package.json` script)
  runs the Lune runner, in place of
  `lune run node_modules/@rbxts/lunit/scripts/lunit.luau`. It passes every
  argument through and needs `lune` on `PATH`.
- **Run options.** `TestRunOptions` gains `excludeTags`, `filter` (plain text,
  matched against `Class.method` and display names) and `bail`. The Lune
  runner exposes them, with `tags`, as `--exclude-tag`, `--filter`, `--tag`
  and `--bail`. `lunit --help` lists every option.
- **Runtime tags.** `@Tag("Lune")` and `@Tag("Roblox")` (or `"Studio"`) run a
  test or class only in that runtime. In the other runtime it is skipped with
  `Lune only` / `Roblox only`, and its lifecycle hooks do not run.

### Changed

- The Lune runner's `tests-root` default is now `out` (was `out/test`), so
  `lunit` with no arguments finds tests anywhere in the build output.
- With `tags`, `excludeTags` or `filter` set, classes left with no tests are
  not reported.

### Fixed

- The report showed no `SKIPPED` label or reason for tests skipped by a
  class-level `@Disabled` / `@Skip`. It now uses each result's skip reason.
- `@Negated` messages were swapped: a negated test that failed had an empty
  message, and one that passed had "unexpectedly did not error". A skipped
  negated test also lost its skip reason.

## [4.1.0] - 2026-11-26

### Added

- **Roblox APIs under Lune.** `game` is now a real Lune DataModel built from
  your Rojo project file, and `script` is a real `ModuleScript`. Every
  datatype that `@lune/roblox` exports (`Vector3`, `CFrame`, `Enum`,
  `Instance`, ...) is a global, and `game:GetService` works for every
  service. New services and datatypes come with Lune updates.
- **Engine stand-ins** for methods with one correct headless answer:
  `WaitForChild` (fails at once instead of hanging), `RunService:Is*`
  (`false`), `HttpService:JSONEncode` / `JSONDecode` / `GenerateGUID`.
- **Setup file.** `lunit.setup.luau` (or `--setup <file>`) runs before any
  test loads, for project-specific stand-ins.
- Lune shim: `TS.generator`, so generator functions work.

### Changed

- `Runtime.isRoblox()` also checks `_G.__LUNIT_LUNE`, which the Lune runner
  sets, because `typeof(game)` is now `"Instance"` under Lune too.

## [4.0.3] - 2026-11-26

### Fixed

- **The Lune runner now works with game projects.** roblox-ts compiles game
  projects to `require(...RuntimeLib)` and `game:GetService(...)` imports,
  which failed with `attempt to index nil with 'GetService'`. The runner now
  reads `default.project.json` (or `--project <file>`) and maps instance paths
  to files through each `$path`.
- **`lunit-root` default.** It was `out`, which does not contain Lunit in a
  consumer project. It is now `node_modules/@rbxts/lunit/out`, or the `out`
  folder next to the runner script.
- Lune shim: add `TS.getModule` so packages can import other packages; load
  `.lua` and `init.lua` files (older published packages); script stand-ins
  support `Name`, `WaitForChild` and `FindFirstChild`.
- Lune shim: modules are cached by file, so a module reached by two paths
  (for example, Lunit through `rbxts_include` and through `lunit-root`) loads
  once.

## [4.0.0] - 2026-04-27

This is a major release. The signature change to `Assert.timeout` is the only
unambiguous source-level break, but the silent no-op fixes below mean tests
that were quietly skipped under 3.0.1 will start running — that's a behavior
change worth flagging before upgrading.

### Breaking changes

- **`Assert.timeout` is no longer async.** Return type changed from
  `Promise<void>` to `void`. The body was always synchronous (it used
  `awaitStatus()` to block). If you had `await Assert.timeout(...)`, drop
  the `await`.
- **Non-parameterized tests now run.** `[undefined]` was used as a
  single-iteration sentinel in the runner — but `{ nil }` collapses to an
  empty table in Luau, so any test without `@Each` was silently skipped.
  Switched to `[{}]`. If you had tests passing under 3.0.1 because they
  weren't actually executing, they'll start running (and possibly failing).
- **Class-level `@Disabled`/`@Skip`/`@Order` now take effect.** Previously
  they registered metadata but the runner ignored it. A `@Disabled` class
  will now skip every test inside; `@Order(n)` on a class controls the
  order classes run in. If you had `@Disabled` on a class expecting tests
  to keep running anyway, remove it.
- **Default discovery glob expanded.** `TestRunner` and the Lune runner
  now match both `*.test` and `*.spec` filenames. If you had `.spec.ts`
  files in your test root that you didn't intend to register as tests,
  they'll now be picked up. Pass an explicit `globPattern` to opt out.
- **Printer output format.** Status symbols changed from emoji
  (`✅ ❌ ⏭️`) to single-width characters (`✓ ✗ ↓`); blank-line spacing
  tightened. If you were parsing the output programmatically, update your
  matchers.
- **`Reporter.getReport` and `Reporter.output`** are typed as arrow
  properties rather than method shorthand. Existing implementations using
  method-shorthand syntax still work; arrow assignments now work too.

### Added

- **Lune support.** `scripts/lunit.luau` is a standalone runner that
  auto-discovers `*.test.luau` / `*.spec.luau` recursively and exits
  non-zero on failure. Pulls in a runtime shim
  (`scripts/lune-shim.luau`), a minimal Promise (`scripts/promise.luau`,
  ~115 lines vs `@rbxts/promise`'s ~2000), and an ANSI-colored reporter
  (`scripts/lune-reporter.luau`). Roblox path is unchanged.
- **`TestRunner.fromClasses(classes)`** and chainable `addClass(ctor)` —
  explicit class registration for environments without a DataModel.
- **`Runtime.isRoblox()` / `Runtime.isLune()`** for gating tests by host.
  Pair with `@Skip`, e.g. `@Skip(!Runtime.isRoblox(), "Roblox only")`.
- **`@Retry(count)`** — re-runs a failing test up to `count` extra times.
- **`@Repeat(count)`** — runs a test `count` times; any failed iteration fails
  the test.
- **`@Each(rows)`** — parameterized tests. Each row becomes its own
  invocation with a labeled case suffix (`addition (1, 2, 3)`).
- **`@Only`** — focus mode at the method or class level.
- **Path-annotated diffs** for `Assert.deepEqual` — failure messages include
  the exact path of every mismatch.
- **Expanded `Assert` API.** New: `notEqual`, `notDeepEqual`, `between`,
  `approximately`, `notEmpty`, `doesNotContain`, `match`, `startsWith`,
  `endsWith`, `doesNotThrow`, `fail`, `notUndefined`. Assertion messages can
  now also be lazy functions.
- **Reporter `output` hook** — override how the final report is emitted. Used
  by the colored Lune reporter; lets consumers swap in custom sinks.
- **`TestCaseResult.label` / `caseIndex` / `caseArgs`** for richer reporter
  integrations.
- **Dogfood test suite.** 58 tests across `assert`, `decorator`, `runner`,
  and `runtime` modules, run on every push.
- **GitHub Actions CI** — runs the full Lune suite on push/PR.
- **Rojo project + Roblox entry script** — `default.project.json` plus
  `scripts/run-tests.server.luau` for in-Studio runs.

### Changed

- **Modular `lib/` layout.** Source reorganized into `lunit/lib/`
  (`assert`, `decorator`, `metadata`, `reporter`, `runner`, `runtime`,
  `shared`).
- **`TestClassInstance`** relaxed from `Record<string, Callback>` to
  `object` — test classes no longer need an index signature.
- **Toolchain.** Migrated to pnpm + rokit, ESLint flat config.

### Fixed

- Lifecycle hook errors no longer dump the verbose `@rbxts/promise`
  Promise.Error trace to the warn channel — the original error value is
  extracted via `.error` when present.

## [3.0.1] - earlier

See git history for releases prior to 4.0.0.
