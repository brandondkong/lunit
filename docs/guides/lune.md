---
outline: deep
---

# Running under Lune

[Lune](https://lune-org.github.io/docs/) is a standalone Luau runtime — no
Roblox, no Studio, just a binary you run from the terminal. Lunit's compiled
output runs there, so the same `*.test.ts` files that drive your in-game
test suite also run in CI in milliseconds.

## Why bother?

- **Speed.** A full Lune run finishes before Studio finishes loading.
- **CI.** GitHub Actions can run the suite directly; no headless Roblox.
- **Hermetic.** No DataModel state to clean up between runs.

The catch: Lune is not the Roblox engine. `game`, services, instances and
datatypes exist (see [Roblox APIs under Lune](#roblox-apis-under-lune)), but
engine behavior (physics, replication, players, DataStores, `task.wait`
timing) does not. Use `@Skip` + `Runtime.isRoblox()` to gate those tests.

## Install Lune

[Rokit](https://github.com/rojo-rbx/rokit) is the easy path:

```bash
rokit add lune-org/lune
```

Or grab a binary release from [lune-org/lune](https://github.com/lune-org/lune/releases).

## Run the suite

After your TypeScript build (rbxtsc / `pnpm build`), run the `lunit` command
from your project root:

```bash
npx lunit
```

`lunit` is a small Node wrapper that runs
`lune run node_modules/@rbxts/lunit/scripts/lunit.luau` with your arguments.
It needs `lune` on `PATH`.

All arguments are optional:

| Arg                   | Default                         | Meaning                                                                               |
| --------------------- | ------------------------------- | ------------------------------------------------------------------------------------- |
| `tests-root`          | `out`                           | Directory to walk recursively for `*.test.luau` / `*.spec.luau` (or `.lua`)           |
| `lunit-root`          | `node_modules/@rbxts/lunit/out` | Directory containing the compiled Lunit framework                                     |
| `--filter <text>`     |                                 | Run only tests whose `Class.method` or display name contains `<text>`                 |
| `--tag <tag>`         |                                 | Run only tests with this tag. Repeat it, or separate tags with commas                 |
| `--exclude-tag <tag>` |                                 | Leave out tests with this tag. Repeat it, or separate tags with commas                |
| `--bail`              |                                 | Stop after the first failing test                                                     |
| `--coverage`          |                                 | Print line coverage and write `coverage/lcov.info` (see [Coverage](/guides/coverage)) |
| `--project <file>`    | `default.project.json`          | Rojo project file used to resolve `game:GetService(...)` imports                      |
| `--setup <file>`      | `lunit.setup.luau`, if present  | Setup file run before tests load (see [Setup file](#setup-file))                      |

You only need `lunit-root` if you've vendored Lunit somewhere else. Flags
also accept `--flag=value`. `lunit --help` prints this list.

```bash
npx lunit --filter TestInventory          # one class
npx lunit --filter TestInventory.addsItem # one test
npx lunit --tag smoke --bail              # smoke tests, stop at the first failure
npx lunit --exclude-tag slow,integration  # everything but slow and integration tests
```

The runner exits non-zero on any failure, so it composes with CI:

```yaml
# .github/workflows/test.yml
- run: pnpm install --frozen-lockfile
- run: pnpm run build
- uses: CompeyDev/setup-rokit@v0.1.2
- run: npx lunit
```

## Game projects

In a `"game"` project, roblox-ts compiles imports to instance paths, not
relative ones:

```lua
local TS = require(game:GetService("ReplicatedStorage"):WaitForChild("rbxts_include"):WaitForChild("RuntimeLib"))
local _lunit = TS.import(script, game:GetService("ReplicatedStorage"), "rbxts_include", "node_modules", "@rbxts", "lunit", "out")
```

The runner reads your Rojo project file and builds the same tree in a Lune
DataModel: a `Folder` for each directory and a `ModuleScript` for each Lua
file, as Rojo does. For example, `ReplicatedStorage.TS` holds the modules in
`out/shared`. Run the runner from your project root, where
`default.project.json` is. If your project file has a different name, pass
`--project`:

```bash
npx lunit --project dev.project.json
```

Package projects (`_G[script]` output) need no project file.

## Roblox APIs under Lune

`game` is a real Lune `DataModel`, and `script`
is a real `ModuleScript`. `IsA`, `typeIs`, `Parent`, `FindFirstChild`,
attributes and tags work as in Roblox.

- **Datatypes.** Every datatype that `@lune/roblox` exports is a global:
  `Vector3`, `CFrame`, `Color3`, `UDim2`, `Enum`, `Instance` and more.
- **Services.** `game:GetService(name)` works for every service in Roblox's
  API. Lune ships Roblox's reflection database, so new services and datatypes
  arrive when you update Lune. Lunit keeps no list of its own.
- **Engine methods.** Lune implements the general `Instance` API, not engine
  behavior. A missing method fails with a clear error, for example
  `GetPlayers is not a valid member of Players`.

Lunit adds a method only when it has exactly one correct answer in a headless
run:

| Method                                                                                 | Under Lune                                                   |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `Instance:WaitForChild`                                                                | Returns the child. Returns `nil` with a timeout; else fails. |
| `RunService:IsStudio` / `IsClient` / `IsServer` / `IsRunning` / `IsRunMode` / `IsEdit` | `false`                                                      |
| `HttpService:JSONEncode` / `JSONDecode`                                                | Real JSON, through `@lune/serde`                             |
| `HttpService:GenerateGUID`                                                             | A random version 4 GUID                                      |

`WaitForChild` cannot wait under Lune: nothing else adds children while a
module loads. It fails at once instead of hanging.

Methods with no single correct answer (DataStores, HTTP requests, players)
stay missing on purpose: a guessed value can make a wrong test pass. Fake them
for your own game in a setup file, or gate the test with `Runtime.isRoblox()`.

`typeof(game)` is `"Instance"` under Lune too. `Runtime.isLune()` still
returns `true`, because the runner sets `_G.__LUNIT_LUNE`.

## Setup file

A setup file runs before any test module loads. Use it for stand-ins that only
make sense in your game: instances your modules expect at load time, or engine
methods with a value that suits your tests.

The runner uses `lunit.setup.luau` in the folder you run from, if it exists.
Pass `--setup <file>` to use another file. It is a normal Lune module, so
`require("@lune/roblox")` and relative requires work. If it returns a
function, the runner calls it with `{ game = game }`:

```lua
-- lunit.setup.luau
local roblox = require("@lune/roblox")

-- Fake an engine method for every Players instance.
roblox.implementMethod("Players", "GetPlayers", function()
	return {}
end)

return function(ctx)
	-- A folder that a module waits for at load time.
	local plots = roblox.Instance.new("Folder")
	plots.Name = "Plots"
	plots.Parent = ctx.game:GetService("Workspace")
end
```

## Wrap it in `npm test`

```json
{
	"scripts": {
		"build": "rbxtsc",
		"test": "rbxtsc && lunit"
	}
}
```

Now `pnpm test` (or `npm test`) does the right thing.

## What's actually shipped

Lunit's npm package bundles these Lune-side helpers under
`node_modules/@rbxts/lunit/scripts/`:

| File                 | Role                                                                       |
| -------------------- | -------------------------------------------------------------------------- |
| `cli.js`             | The `lunit` command; runs `lunit.luau` with Lune                           |
| `lunit.luau`         | Entry point — auto-discovery + runner                                      |
| `lune-shim.luau`     | Builds the DataModel and the roblox-ts runtime (`_G[script]`, RuntimeLib)  |
| `promise.luau`       | Minimal Promise covering only what the framework needs (~115 lines)        |
| `lune-reporter.luau` | ANSI-colored output for `PASSED` / `FAILED` / `SKIPPED` and status symbols |

You don't need to touch any of these directly — `lunit.luau` requires the
Luau files as siblings. They exist so the Lune path doesn't drag in
`@rbxts/promise` (~2000 lines, Roblox-coupled).

## Gating tests by runtime

Some tests only make sense in one runtime. Tag them with the runtime they need:

```ts
import { Tag, Test } from "@rbxts/lunit";

class TestServices {
	@Tag("Roblox")
	@Test
	public firesRemoteEvent() {
		// skipped under Lune: "SKIPPED (Roblox only)"
	}

	@Tag("Lune")
	@Test
	public usesLuneFs() {
		// skipped under Roblox: "SKIPPED (Lune only)"
	}
}

export = TestServices;
```

`"Studio"` works the same as `"Roblox"`. A runtime tag on a class applies to
every test in it. A test skipped this way does not run its `@BeforeEach` /
`@AfterEach` hooks, and a skipped class does not run `@BeforeAll` /
`@AfterAll`, since those may call APIs that the other runtime lacks.

For other conditions, `@Skip` with `Runtime.isRoblox()` / `Runtime.isLune()`
still works:

```ts
@Skip(!Runtime.isRoblox(), "needs a live server")
```

A `SKIPPED` line in the output makes the gating visible — silent skips would
let detection silently break.

## Troubleshooting

**`module not found: out/tests`** — your TS hasn't been built yet, or your
output dir is somewhere other than `out/`. Run `rbxtsc` first.

**`Infinite yield: ReplicatedStorage.rbxts_include does not exist ... (no Rojo
project file loaded ...)`** — a game project's import could not be found. Run
from the folder that holds `default.project.json`, or pass `--project <file>`.

**`module not found: ReplicatedStorage.TS.x`** — the instance is not in your
Rojo tree. Check the `$path` entries in your project file, and check that the
file was compiled.

**`X is not a valid member of Y`** — a module calls an engine method that Lune
does not have. Fake it in a [setup file](#setup-file), or gate the test with
`@Skip(!Runtime.isRoblox(), ...)`.

**`attempt to index nil with 'X'` from a test** — usually a Roblox API leaking
into a test that runs under Lune. Wrap with `@Skip(!Runtime.isRoblox(), ...)`.

**Tests pass under Lune but fail under Roblox (or vice versa)** — the runtimes
differ on `task.wait` semantics, `os.clock` precision, and DataModel
availability. Check `Runtime.isRoblox()` to branch behavior in the test, or
split into two separate test classes.
