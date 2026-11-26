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

The catch: Lune has no DataModel. Imports through `game:GetService(...)` work
(see [Game projects](#game-projects)), but real engine behavior (services such
as `RunService`, `Instance` types, `task.wait` semantics that differ from
Lune's) does not. Use `@Skip` + `Runtime.isRoblox()` to gate those tests.

## Install Lune

[Rokit](https://github.com/rojo-rbx/rokit) is the easy path:

```bash
rokit add lune-org/lune
```

Or grab a binary release from [lune-org/lune](https://github.com/lune-org/lune/releases).

## Run the suite

After your TypeScript build (rbxtsc / `pnpm build`), point Lunit's runner at
the compiled tests:

```bash
lune run node_modules/@rbxts/lunit/scripts/lunit.luau out/tests
```

All arguments are optional:

| Arg                | Default                         | Meaning                                                                     |
| ------------------ | ------------------------------- | --------------------------------------------------------------------------- |
| `tests-root`       | `out/test`                      | Directory to walk recursively for `*.test.luau` / `*.spec.luau` (or `.lua`) |
| `lunit-root`       | `node_modules/@rbxts/lunit/out` | Directory containing the compiled Lunit framework                           |
| `--project <file>` | `default.project.json`          | Rojo project file used to resolve `game:GetService(...)` imports            |

You only need `lunit-root` if you've vendored Lunit somewhere else.

## Game projects

In a `"game"` project, roblox-ts compiles imports to instance paths, not
relative ones:

```lua
local TS = require(game:GetService("ReplicatedStorage"):WaitForChild("rbxts_include"):WaitForChild("RuntimeLib"))
local _lunit = TS.import(script, game:GetService("ReplicatedStorage"), "rbxts_include", "node_modules", "@rbxts", "lunit", "out")
```

The runner reads your Rojo project file and uses each `$path` to map these
instance paths back to files. For example, `ReplicatedStorage.TS` maps to
`out/shared` and `ReplicatedStorage.rbxts_include.node_modules.@rbxts` maps to
`node_modules/@rbxts`. Run the runner from your project root, where
`default.project.json` is. If your project file has a different name, pass
`--project`:

```bash
lune run node_modules/@rbxts/lunit/scripts/lunit.luau out --project dev.project.json
```

Under Lune, `game` is a stand-in that only resolves paths. `game:GetService`,
`WaitForChild`, `FindFirstChild`, `Parent` and `Name` work for module lookups.
Service methods (for example `RunService:IsStudio()`) do not exist. Gate tests
that need them with `Runtime.isRoblox()`. `typeof(game)` is `"table"`, so
`Runtime.isLune()` stays `true`.

Package projects (`_G[script]` output) need no project file.

The runner exits non-zero on any failure, so it composes with CI:

```yaml
# .github/workflows/test.yml
- run: pnpm install --frozen-lockfile
- run: pnpm run build
- uses: CompeyDev/setup-rokit@v0.1.2
- run: lune run node_modules/@rbxts/lunit/scripts/lunit.luau out/tests
```

## Wrap it in `npm test`

```json
{
	"scripts": {
		"build": "rbxtsc",
		"test": "rbxtsc && lune run node_modules/@rbxts/lunit/scripts/lunit.luau out/tests"
	}
}
```

Now `pnpm test` (or `npm test`) does the right thing.

## What's actually shipped

Lunit's npm package bundles four Lune-side helpers under
`node_modules/@rbxts/lunit/scripts/`:

| File                 | Role                                                                       |
| -------------------- | -------------------------------------------------------------------------- |
| `lunit.luau`         | Entry point — auto-discovery + runner                                      |
| `lune-shim.luau`     | Synthesizes the roblox-ts runtime (`_G[script]`, RuntimeLib, `TS.import`)  |
| `promise.luau`       | Minimal Promise covering only what the framework needs (~115 lines)        |
| `lune-reporter.luau` | ANSI-colored output for `PASSED` / `FAILED` / `SKIPPED` and status symbols |

You don't need to touch any of these directly — `lunit.luau` requires the
others as siblings. They exist so the Lune path doesn't drag in
`@rbxts/promise` (~2000 lines, Roblox-coupled).

## Gating tests by runtime

Some tests only make sense in one runtime. `Runtime.isRoblox()` /
`Runtime.isLune()` paired with `@Skip` is the idiomatic gate:

```ts
import { Skip, Test, Runtime, Assert } from "@rbxts/lunit";

class TestServices {
	@Skip(!Runtime.isRoblox(), "Roblox only")
	@Test
	public touchesRunService() {
		// uses game:GetService("RunService"); skipped under Lune
	}

	@Skip(!Runtime.isLune(), "Lune only")
	@Test
	public usesLuneFs() {
		// uses @lune/fs; skipped under Roblox
	}
}

export = TestServices;
```

A `SKIPPED` line in the output makes the gating visible — silent skips would
let detection silently break.

## Troubleshooting

**`module not found: out/tests`** — your TS hasn't been built yet, or your
output dir is somewhere other than `out/`. Run `rbxtsc` first.

**`module not found: @game/... (no Rojo project file loaded ...)`** — a game
project's import could not be mapped to a file. Run from the folder that holds
`default.project.json`, or pass `--project <file>`.

**`module not found: @game/... (no $path in ... covers this instance)`** — the
instance path is not in your Rojo tree. Check the `$path` entries in your
project file.

**`attempt to index nil with 'X'` from a test** — usually a Roblox API leaking
into a test that runs under Lune. Wrap with `@Skip(!Runtime.isRoblox(), ...)`.

**Tests pass under Lune but fail under Roblox (or vice versa)** — the runtimes
differ on `task.wait` semantics, `os.clock` precision, and DataModel
availability. Check `Runtime.isRoblox()` to branch behavior in the test, or
split into two separate test classes.
