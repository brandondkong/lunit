---
outline: deep
---

# Decorators

Lunit's API surface is decorators. You attach them to test classes (and the
methods inside) to declare intent — what's a test, what's setup, what to
skip — without writing any registration boilerplate.

```ts
import { Test, BeforeEach, Assert } from "@rbxts/lunit";

class TestSum {
	private value = 0;

	@BeforeEach
	public reset() {
		this.value = 0;
	}

	@Test
	public addsTwoNumbers() {
		this.value = 1 + 1;
		Assert.equal(this.value, 2);
	}
}

export = TestSum;
```

Decorators come in two flavors:

-   **Method-only** (`@Test`, `@BeforeEach`, `@Timeout`, `@Each`, `@Retry`,
    `@Repeat`, `@Negated`) — apply to a single method.
-   **Shared** (`@DisplayName`, `@Order`, `@Tag`, `@Skip`, `@Disabled`, `@Only`)
    — apply to either a method or the whole class. When placed on the class,
    every test inside inherits the behavior.

## Marking tests

### `@Test`

Marks a method as a test case. A class is only run if it has at least one
`@Test` method.

```ts
class TestSum {
	@Test
	public addsTwoNumbers() {
		Assert.equal(1 + 1, 2);
	}
}
```

## Lifecycle hooks

Each hook fires around every `@Test` method on the class. State you mutate
in `@BeforeEach` is visible inside the test; state from `@AfterEach` runs
even if the test failed.

### `@BeforeAll`

Runs once before any test in the class.

```ts
class TestDatabase {
	@BeforeAll
	public connect() {
		// open a shared resource
	}
}
```

### `@AfterAll`

Runs once after every test in the class has finished, pass or fail.

```ts
class TestDatabase {
	@AfterAll
	public disconnect() {
		// close the shared resource
	}
}
```

### `@BeforeEach` / `@Before`

Runs before each test. `@Before` is an alias.

```ts
class TestSum {
	private value = 0;

	@BeforeEach
	public reset() {
		this.value = 0;
	}
}
```

### `@AfterEach` / `@After`

Runs after each test. `@After` is an alias.

```ts
class TestSum {
	@AfterEach
	public cleanup() {
		// per-test teardown
	}
}
```

## Skipping & disabling

### `@Disabled`

Marks a test (or every test on the class) as skipped. Optional message
appears in the report.

```ts
class TestSum {
	@Disabled("not implemented yet")
	@Test
	public unfinishedTest() {}
}
```

### `@Skip`

Skips a test conditionally. Takes a `boolean` or a function returning one,
plus an optional message. Useful for runtime-gating with the `Runtime` helper:

```ts
import { Skip, Test, Runtime, Assert } from "@rbxts/lunit";

class TestServices {
	@Skip(!Runtime.isRoblox(), "Roblox only")
	@Test
	public touchesRunService() {
		// runs in Studio; SKIPPED under Lune
	}

	@Skip(() => os.clock() < 0, "never true, but evaluated lazily")
	@Test
	public lazyCondition() {}
}
```

The condition is evaluated when the runner reads the test list, so a
function form lets you defer expensive checks.

## Display & ordering

### `@DisplayName`

Overrides how the test shows up in the report. Useful when the method name
is awkward in prose.

```ts
class TestSum {
	@DisplayName("adds two positive numbers")
	@Test
	public addsTwoNumbers() {
		Assert.equal(1 + 1, 2);
	}
}
```

### `@Order`

Sets execution order within a class. Tests with lower order run first.
Tests without `@Order` use the framework's default (which currently sorts
them after explicitly-ordered ones; don't rely on relative order between
unmarked tests).

```ts
class TestSum {
	@Order(1)
	@Test
	public first() {}

	@Order(2)
	@Test
	public second() {}
}
```

## Filtering

### `@Tag`

Attaches one or more tags. Tags are used by the runner to filter which
tests to actually run.

```ts
class TestSum {
	@Tag("smoke", "math")
	@Test
	public addsTwoNumbers() {
		Assert.equal(1 + 1, 2);
	}
}
```

```ts
import { TestRunner } from "@rbxts/lunit";

await TestRunner.fromClasses([TestSum]).run({ tags: ["smoke"] });
```

A test runs if **any** of its tags (or its class's tags) matches **any**
of the requested tags. Pass no `tags` and everything runs.

### `@Only`

Focus mode. When any test or class is `@Only`, only those run; everything
else is implicitly skipped. Method-level `@Only` narrows within a class;
class-level `@Only` narrows across the whole run.

```ts
class TestSum {
	@Only
	@Test
	public theOneIcareAbout() {}

	@Test
	public ignoredWhileOnlyIsActive() {}
}
```

Convenient for iterating on a single test. Pull the `@Only` before
committing — Lunit doesn't warn about leftover focus markers.

## Flake handling

### `@Retry`

Re-runs a failing test up to `count` extra times. The first passing
attempt wins; lifecycle hooks (`@BeforeEach` / `@AfterEach`) fire fresh
for every attempt.

```ts
class TestNetwork {
	@Retry(3)
	@Test
	public flakyHttpCall() {
		// up to 4 total attempts
	}
}
```

Use sparingly — retries hide signal. Reserve for genuinely external
flake (network, timing) rather than papering over bugs.

### `@Repeat`

Runs a test `count` times. Any failed iteration fails the test. Lifecycle
hooks fire for every iteration. Pairs with race-condition or
property-style testing.

```ts
class TestRace {
	@Repeat(50)
	@Test
	public raceConditionCheck() {
		// runs 50 times, fails the test if any iteration trips
	}
}
```

`@Retry` and `@Repeat` compose — `@Repeat(10) @Retry(2)` runs ten
iterations, each of which gets up to two extra attempts before the
iteration counts as failed.

## Parameterized tests

### `@Each`

Runs the same test method once per row, with the row's values spread as
arguments. Each row produces an independent test result with a labeled
case suffix.

```ts
class TestAddition {
	@Each([
		[1, 2, 3],
		[10, 20, 30],
		[-1, 1, 0],
	])
	@Test
	public addition(a: number, b: number, sum: number) {
		Assert.equal(a + b, sum);
	}
}
```

Output:

```plaintext
[✓] TestAddition (1ms)
 │	├── [✓] addition (1, 2, 3) (0ms) PASSED
 │	├── [✓] addition (10, 20, 30) (0ms) PASSED
 │	└── [✓] addition (-1, 1, 0) (0ms) PASSED
```

## Misc

### `@Timeout`

Fails the test if it doesn't complete within `ms` milliseconds. The test
keeps running in the background even after the timeout fires — your
asserts simply don't observe it.

```ts
class TestSlow {
	@Timeout(500)
	@Test
	public async fastEnough() {
		await Promise.delay(0.1); // succeeds (100ms < 500ms)
	}
}
```

Timeouts only fire if the test yields. A busy CPU loop won't get
interrupted; use `task.wait` or await a `Promise.delay` to give the
scheduler a chance.

### `@Negated`

Flips the test's pass/fail result. Useful for testing assertions
themselves, or pairing with `@Timeout` to assert "this should be slow."

```ts
class TestNegation {
	@Negated
	@Test
	public expectedToFail() {
		error("boom"); // passes — error was expected
	}

	@Negated
	@Timeout(100)
	@Test
	public expectedToTimeout() {
		while (true) task.wait(); // passes — timeout was expected
	}
}
```

Reach for `@Negated` rarely; `Assert.throws` is usually a clearer way to
assert "this should error."
