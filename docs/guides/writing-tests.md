---
outline: deep
---

# Writing tests

Lunit tests are TypeScript classes. Methods marked `@Test` are test cases;
everything else (helpers, fixtures, lifecycle hooks) is yours to organize.
This page walks the patterns you'll reach for once you're past
[Getting Started](/getting-started).

## File layout

```
src/
  module.ts
  module.test.ts       <- co-located test
tests/
  integration/
    auth.spec.ts       <- grouped feature tests
```

The default discovery glob matches `*.test` and `*.spec` filenames in
either layout. Pick whichever convention reads better in your project — or
mix.

Each file should `export = ` exactly one class. Lunit's runner registers
the default export from each matched module.

```ts
import { Test, Assert } from "@rbxts/lunit";

class TestModule {
	@Test
	public someBehavior() {}
}

export = TestModule;
```

## Anatomy of a test class

```ts
import { BeforeAll, BeforeEach, AfterEach, AfterAll, Test, Assert } from "@rbxts/lunit";

class TestUserService {
	private service!: UserService;
	private created: User[] = [];

	@BeforeAll
	public connect() {
		// expensive one-time setup
	}

	@BeforeEach
	public reset() {
		this.service = new UserService();
		this.created = [];
	}

	@AfterEach
	public cleanup() {
		for (const user of this.created) this.service.delete(user);
	}

	@AfterAll
	public disconnect() {
		// expensive one-time teardown
	}

	@Test
	public createsAUser() {
		const user = this.service.create({ name: "Ada" });
		this.created.push(user);
		Assert.equal(user.name, "Ada");
	}
}

export = TestUserService;
```

A new instance of the class is created per **runner**, not per test.
Methods share `this`, so `@BeforeEach` is the right place to reset state.

## Picking assertions

`Assert` throws on failure. The handful you'll reach for most:

```ts
Assert.equal(actual, expected);            // strict ===
Assert.deepEqual({ a: 1 }, { a: 1 });      // recursive — reports diff paths
Assert.true(condition);                    // strictly true (not just truthy)
Assert.throws(() => parse("nope"));        // callback must throw
Assert.match("hello world", "^hello");     // Lua pattern
```

See the [API Reference](/api-reference#assert) for the full list.

### Lazy messages

Pass a function as the optional last argument when constructing the message
is expensive — Lunit only invokes it on failure:

```ts
Assert.equal(snapshot, expected, () => `mismatch:\n${diff(snapshot, expected)}`);
```

### When `deepEqual` isn't enough

`deepEqual` walks tables but treats Roblox datatypes (Vector3, CFrame,
Instance) as opaque — they compare by `===`. For approximate Vector3
comparison, write the math out:

```ts
const delta = actual.sub(expected);
Assert.lessThan(delta.Magnitude, 0.01);
```

## Parameterizing

`@Each` runs the same test once per row. The row's values are spread as
arguments to the method, and each invocation gets its own pass/fail row in
the report.

```ts
class TestParse {
	@Each([
		["1", 1],
		["1.5", 1.5],
		["-3", -3],
	])
	@Test
	public parsesNumber(input: string, expected: number) {
		Assert.equal(parseNumber(input), expected);
	}
}
```

Output:

```plaintext
[✓] TestParse (0ms)
 │	├── [✓] parsesNumber (1, 1) (0ms) PASSED
 │	├── [✓] parsesNumber (1.5, 1.5) (0ms) PASSED
 │	└── [✓] parsesNumber (-3, -3) (0ms) PASSED
```

Use this over a manual `for` loop inside one test — independent rows give
independent failure messages.

## Async tests

Mark the method `async` and `await` whatever you need. The runner awaits
the returned promise.

```ts
class TestNetwork {
	@Test
	public async fetchesData() {
		const result = await fetch("/users/1");
		Assert.equal(result.status, 200);
	}
}
```

Pair with `@Timeout(ms)` to fail tests that hang. The timeout only fires
on yields — a busy CPU loop won't be interrupted.

## Sharing helpers across test classes

Put shared fixtures in plain modules and import where needed. Don't try to
inherit from a base test class — Lunit registers exactly the constructor
you `export =`, and inherited `@Test` methods would re-execute on every
subclass.

```ts
// tests/_fixtures/users.ts
export function makeUser(overrides: Partial<User> = {}): User {
	return { name: "Default", age: 30, ...overrides };
}
```

```ts
// tests/users.test.ts
import { makeUser } from "./_fixtures/users";

class TestUsers {
	@Test
	public greets() {
		const user = makeUser({ name: "Ada" });
		Assert.equal(greet(user), "Hello, Ada");
	}
}

export = TestUsers;
```

Prefix shared modules with `_` (or any name not matching `*.test` /
`*.spec`) so they aren't picked up by discovery.

## Iterating quickly

A few decorators are designed for the inner-loop:

-   **`@Only`** — focus mode. Add it to one test (or one class) and Lunit
    runs only what's marked. Pull it before committing.
-   **`@Disabled("reason")`** — temporary skip. The reason shows up in the
    report so it's visible across the team.
-   **`@Tag("slow")`** plus `run({ tags: ["smoke"] })` — split your suite
    into fast and slow buckets, run only what you need.

## Flake handling

Genuine external flakes (network, scheduling, shared state) get
`@Retry(n)`:

```ts
class TestNetwork {
	@Retry(3)
	@Test
	public flakyEndpoint() {
		// up to 4 attempts; first pass wins
	}
}
```

Property-style or race-condition checks get `@Repeat(n)`:

```ts
class TestRace {
	@Repeat(50)
	@Test
	public concurrentWritesConverge() {
		// runs 50×; any failed iteration fails the test
	}
}
```

Don't reach for retries to silence a real bug. The history of every retry
is invisible in the final report — only the result of the winning attempt
is shown.

## Two runtimes, one suite

If your tests span both Roblox and Lune, use `Runtime` + `@Skip` to gate
runtime-specific cases:

```ts
import { Runtime, Skip, Test, Assert } from "@rbxts/lunit";

class TestPlatform {
	@Skip(!Runtime.isRoblox(), "Roblox only")
	@Test
	public touchesDataModel() {}

	@Skip(!Runtime.isLune(), "Lune only")
	@Test
	public touchesLuneFs() {}

	@Test
	public worksAnywhere() {
		Assert.equal(1 + 1, 2);
	}
}
```

Skipped tests appear as `SKIPPED` in the report — that's intentional, so
detection silently breaking is visible.

See [Running under Lune](/guides/lune) for the runtime story.
