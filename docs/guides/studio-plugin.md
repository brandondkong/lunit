---
outline: deep
---

# Studio plugin

The Lunit plugin runs your tests inside Roblox Studio without pressing Play.
It lists every test in the place, runs all of them, one class or one test,
shows why a test failed, and opens the script at the failing line. With a
coverage build synced, it also shows line coverage.

## Install

Build it from the Lunit repository with [Rojo](https://rojo.space):

```bash
git clone https://github.com/brandondkong/lunit
cd lunit
rokit install
cd plugin
pnpm install
pnpm run install:plugin
```

`install:plugin` builds `Lunit.rbxm` into Studio's local Plugins folder.
Restart Studio, or reload plugins, and a **Tests** button appears under the
**Lunit** toolbar. Each CI run also uploads the built `Lunit.rbxm` as an
artifact.

The plugin needs `@rbxts/lunit` 4.4 or later in your project, synced into
the place with Rojo as usual.

## Using it

Open the panel with the **Tests** button. It finds every `*.test` and
`*.spec` ModuleScript in the place and lists their classes and tests.

- **Run all** runs every test. With a search, the button reads **Run shown**
  and runs only the tests the search leaves.
- The **▶** button on a class or test runs just that class or test.
- **Refresh** finds the tests again, for example after Rojo syncs new files.
  Results from the last run stay.
- Click a test to see its result. For a failure, **Open script** opens the
  test's script at the failing line.

The search box matches class and test names and display names. Add
`tag:name` to keep only tests with that tag, on the test or its class:

```plaintext
shop tag:smoke
```

## Coverage

Sync a coverage build (see [Coverage](/guides/coverage)), turn on
**Coverage** in the panel and run. The **Coverage** tab then lists each file
with its line coverage and missed lines, lowest first. The line numbers are
in your TypeScript files.

```bash
rbxtsc -p tsconfig.coverage.json
rojo serve
```

Switch back to your normal build when you are done; see
[Switching builds](/guides/coverage#switching-builds).

## How it runs tests

The plugin runs tests in Edit mode, from the code as it is now:

- **Fresh code each run.** It loads every module from its current source
  instead of Roblox's `require` cache, so edits and Rojo syncs are picked up
  without restarting Studio. Unsaved edits in the script editor count too.
- **Your copy of Lunit.** It runs the tests with the `@rbxts/lunit` in your
  place, so the plugin and your tests always agree on the version.
- **Changes are undone.** Each run is recorded with ChangeHistoryService and
  the recording is cancelled at the end, so instances the tests create or
  change are put back. If Studio cannot record (for example during Play), the
  panel says so.

Tests run with Studio's engine, so `Runtime.isRoblox()` is true and tests
tagged `@Tag("Roblox")` run, while `@Tag("Lune")` tests are skipped. Edit mode
is not a running game, though: there are no players, and server scripts do
not run.
