# @rbxts/lunit

A TypeScript testing framework for Roblox and Lune. Write tests once, run
them in Studio against a live DataModel **or** outside Roblox under Lune
in milliseconds — same `*.test.ts` files, same output.

[![npm version](https://img.shields.io/npm/v/@rbxts/lunit.svg)](https://www.npmjs.com/package/@rbxts/lunit)
[![CI](https://github.com/brandon-kong/lunit/actions/workflows/test.yml/badge.svg)](https://github.com/brandon-kong/lunit/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Docs](https://img.shields.io/badge/docs-vitepress-brightgreen.svg)](https://github.brandondkong.com/lunit)

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

-   **Decorator-driven.** `@Test`, `@BeforeEach`, `@Each`, `@Retry`,
    `@Repeat`, `@Only`, `@Tag`, and friends — declarative test definitions
    with no setup boilerplate.
-   **Roblox + Lune.** The same files run in Studio (DataModel discovery)
    and under [Lune](https://lune-org.github.io/docs/) (filesystem
    discovery). Gate runtime-specific cases with `@Skip` + `Runtime`.
-   **Path-annotated `deepEqual` diffs.** Failures point at the exact
    nested path that doesn't match.
-   **Parameterized tests** via `@Each`, **flake handling** via
    `@Retry` / `@Repeat`, **focus mode** via `@Only`, **tag filtering**
    via `@Tag`.
-   **Custom reporters.** Override per-test/per-run hooks or replace the
    final summary outright.
-   **Self-contained Lune path.** Ships a runtime shim, a ~115-line Promise
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

**Under Lune** — point the bundled runner at your compiled tests:

```sh
lune run node_modules/@rbxts/lunit/scripts/lunit.luau out/tests
```

Or drop it into `package.json`:

```json
{
	"scripts": {
		"test": "rbxtsc && lune run node_modules/@rbxts/lunit/scripts/lunit.luau out/tests"
	}
}
```

## Documentation

-   [Getting Started](https://github.brandondkong.com/lunit/getting-started) — Roblox, Lune, and both.
-   [Decorators](https://github.brandondkong.com/lunit/guides/decorators) — every decorator, with class-level behavior spelled out.
-   [Writing tests](https://github.brandondkong.com/lunit/guides/writing-tests) — patterns past the basics.
-   [Running under Lune](https://github.brandondkong.com/lunit/guides/lune) — CI, runtime gating, troubleshooting.
-   [API reference](https://github.brandondkong.com/lunit/api-reference)

## Contributing

Issues and PRs welcome. See the [Contributing guide](https://github.brandondkong.com/lunit/contributing)
for the local loop, repo layout, and conventions.

## License

[MIT](LICENSE) © Brandon Kong
