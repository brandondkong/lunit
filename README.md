# @rbxts/lunit

A TypeScript testing framework for Roblox and Lune. Write tests once, run
them in Studio against a live DataModel **or** outside Roblox under Lune
in milliseconds — same `*.test.ts` files, same output.

[![npm version](https://img.shields.io/npm/v/@rbxts/lunit.svg)](https://www.npmjs.com/package/@rbxts/lunit)
[![CI](https://github.com/brandondkong/lunit/actions/workflows/test.yml/badge.svg)](https://github.com/brandondkong/lunit/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Docs](https://img.shields.io/badge/docs-vitepress-brightgreen.svg)](https://docs.kong.ly/lunit/)

```ts
import { Test, BeforeEach, Assert } from "@rbxts/lunit";

class TestSum {
	@Test
	public addsTwoNumbers() {
		Assert.equal(1 + 1, 2);
	}
}

export = TestSum;
```

```text
[✓] TestSum (0ms)
 │   └── [✓] addsTwoNumbers (0ms) PASSED

    Ran 1 tests in 0ms
        Passed: 1
        Failed: 0
        Skipped: 0
```

## Highlights

- **Decorator-driven.** `@Test`, `@BeforeEach`, `@Each`, `@Retry`,
  `@Repeat`, `@Only`, `@Tag`, and friends — declarative test definitions
  with no setup boilerplate.
- **Roblox + Lune.** The same files run in Studio (DataModel discovery)
  and under [Lune](https://lune-org.github.io/docs/) (filesystem
  discovery). Mark runtime-specific cases with `@Tag("Roblox")` or `@Tag("Lune")`.
- **Path-annotated `deepEqual` diffs.** Failures point at the exact
  nested path that doesn't match.
- **Parameterized tests** via `@Each`, **flake handling** via
  `@Retry` / `@Repeat`, **focus mode** via `@Only`, **tag filtering**
  via `@Tag`.
- **Coverage.** Line coverage of your TypeScript, under Lune and in
  Studio, with lcov output for Codecov and editor extensions.
- **Custom reporters.** Override per-test/per-run hooks or replace the
  final summary outright.
- **Self-contained Lune path.** Ships a runtime shim, a ~115-line Promise
  impl, and an ANSI-colored reporter — no `@rbxts/promise` needed
  outside Roblox.

## Install

```sh
pnpm add @rbxts/lunit       # or: npm install @rbxts/lunit
```

For Lune-side runs, install [Lune](https://github.com/lune-org/lune) too:

```sh
rokit add lune-org/lune
```

## Run tests

**In Roblox Studio** — wire up a server script:

```ts
import { TestRunner } from "@rbxts/lunit";
import { ReplicatedStorage } from "@rbxts/services";

new TestRunner([ReplicatedStorage.FindFirstChild("Tests")]).run();
```

**Under Lune** — run the bundled `lunit` command after your build. It finds
every `*.test` / `*.spec` file under `out/`:

```sh
npx lunit
```

Or drop it into `package.json`:

```json
{
	"scripts": {
		"test": "rbxtsc && lunit"
	}
}
```

In GitHub Actions, one step installs Lune, builds and runs the tests:

```yaml
- uses: brandondkong/lunit/action@v4
```

`lunit --help` lists the options: `--filter`, `--tag`, `--exclude-tag`,
`--bail` and more.

## Tooling

- [Lunit Studio plugin](https://docs.kong.ly/lunit/guides/studio-plugin.html): run and inspect
  tests in Roblox Studio without pressing Play, with coverage.
- [Lunit Test Companion](https://marketplace.visualstudio.com/items?itemName=ShaderCloud.vscode-lunit-companion)
  (VS Code, by ShaderCloud) — runs your tests from the Test Explorer, under
  Lune or in Roblox Studio.

See [Tooling](https://docs.kong.ly/lunit/tooling.html) for more.

## Documentation

- [Getting Started](https://docs.kong.ly/lunit/getting-started.html) — Roblox, Lune, and both.
- [Decorators](https://docs.kong.ly/lunit/guides/decorators.html) — every decorator, with class-level behavior spelled out.
- [Writing tests](https://docs.kong.ly/lunit/guides/writing-tests.html) — patterns past the basics.
- [Running under Lune](https://docs.kong.ly/lunit/guides/lune.html) — CI, runtime gating, troubleshooting.
- [Coverage](https://docs.kong.ly/lunit/guides/coverage.html) — line coverage under Lune and in Studio.
- [API reference](https://docs.kong.ly/lunit/api-reference.html)
- [Tooling](https://docs.kong.ly/lunit/tooling.html) — editor support and other tools.

## Contributing

Issues and PRs welcome. See the [Contributing guide](https://docs.kong.ly/lunit/contributing.html)
for the local loop, repo layout, and conventions.

## License

[MIT](LICENSE) © Brandon Kong
