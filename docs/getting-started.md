---
outline: deep
---

# Getting Started

`@rbxts/lunit` runs the same `*.test.ts` files in two places: inside Roblox Studio
(via the DataModel) and outside Roblox via [Lune](https://lune-org.github.io/docs/).
Pick the path that matches how you ship — or wire up both for fast local
feedback plus in-engine integration runs.

## Install

```bash
npm install @rbxts/lunit
# or
pnpm add @rbxts/lunit
```

You don't need anything beyond the package for the Roblox path. The Lune path
also expects [`lune`](https://github.com/lune-org/lune) on `PATH` —
`rokit add lune-org/lune` is the easy way.

## Write a test

A test is a class. Methods marked `@Test` become test cases; everything else
on the class (helpers, fixtures) is yours.

```ts
// src/tests/sum.test.ts
import { Test, Assert } from "@rbxts/lunit";

class TestSum {
	@Test
	public addsTwoNumbers() {
		Assert.equal(1 + 1, 2);
	}
}

export = TestSum;
```

The filename can end in `.test` or `.spec` — both are picked up by default.

## Run in Roblox

Place a server script that builds a `TestRunner` over the folder containing
your compiled tests:

```ts
// src/server/run-tests.server.ts
import { TestRunner } from "@rbxts/lunit";
import { ReplicatedStorage } from "@rbxts/services";

new TestRunner([ReplicatedStorage.FindFirstChild("Tests")]).run();
```

Press Play. Output lands in the Studio Output window:

```plaintext
[✓] TestSum (0ms)
 │	└── [✓] addsTwoNumbers (0ms) PASSED

	Ran 1 tests in 0ms
		Passed: 1
		Failed: 0
		Skipped: 0
```

## Run under Lune

Lunit ships a standalone runner at `node_modules/@rbxts/lunit/scripts/lunit.luau`.
It walks a directory recursively for `*.test.luau` / `*.spec.luau`, registers
each as a test class, and exits non-zero on any failure — perfect for CI or
local watch loops.

```bash
# After your TS build (rbxtsc or pnpm build), point it at the compiled tests
lune run node_modules/@rbxts/lunit/scripts/lunit.luau out/tests
```

Or wrap it in a `package.json` script:

```json
{
	"scripts": {
		"test": "rbxtsc && lune run node_modules/@rbxts/lunit/scripts/lunit.luau out/tests"
	}
}
```

Lune output is identical to Roblox's, with ANSI color when stdout is a TTY:

```plaintext
[✓] TestSum (0ms)
 │	└── [✓] addsTwoNumbers (0ms) PASSED

	Ran 1 tests in 0ms
		Passed: 1
		Failed: 0
		Skipped: 0
```

## Run on both

The same `*.test.ts` files work in both runtimes. A common setup:

-   **Local + CI:** `pnpm test` runs the suite under Lune in milliseconds.
-   **Studio:** the server script above runs the same tests against the live
    DataModel for engine-touching cases.

Some tests only make sense in one runtime — gate them with `@Skip` and the
`Runtime` helper:

```ts
import { Skip, Test, Runtime, Assert } from "@rbxts/lunit";

class TestRemotes {
	@Skip(!Runtime.isRoblox(), "Roblox only")
	@Test
	public remoteEventFires() {
		// uses game.GetService(...), only runs in Studio
	}
}

export = TestRemotes;
```

Under Lune this case appears as `SKIPPED`; under Roblox it runs normally.

## Next steps

-   [Decorators](/guides/decorators) — `@Test`, `@BeforeEach`, `@Each`, `@Retry`,
    `@Only`, `@Tag`, and friends.
-   [Running under Lune](/guides/lune) — deeper Lune setup, CI, runtime gating.
-   [API Reference](/api-reference)

## Resources

-   [GitHub](https://github.com/brandon-kong/lunit)
-   [npm](https://www.npmjs.com/package/@rbxts/lunit)
