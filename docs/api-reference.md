---
outline: deep
---

# API Reference

The complete public surface of `@rbxts/lunit`. For narrative usage, see the
[Decorators guide](/guides/decorators) and [Getting Started](/getting-started).

## `TestRunner`

The orchestrator. Owns a list of test classes and runs them.

### Constructors

#### `new TestRunner(roots?, globPattern?)`

Build a runner from one or more `Instance` roots (Roblox path). The runner
walks each root's descendants for `ModuleScript`s whose name matches the
glob, requires them, and registers any returned class.

```ts
new TestRunner([game.GetService("ReplicatedStorage").Tests]);
```

| Parameter     | Type                                | Default                            | Notes                                                                          |
| ------------- | ----------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------ |
| `roots`       | `ReadonlyArray<Instance \| undefined>` | `[]`                               | Each root is walked recursively. `undefined` entries are skipped.              |
| `globPattern` | `string \| ReadonlyArray<string>`   | `[".+%.test$", ".+%.spec$"]`       | Lua patterns (not regex). Matches file/module name without extension. |

#### `TestRunner.fromClasses(classes)`

Build a runner from an explicit list of test class constructors. Use this
in non-Roblox environments or any time you want full control over which
classes run.

```ts
TestRunner.fromClasses([TestAssert, TestDecorators]);
```

### Methods

#### `addRoot(root, globPattern?)`

Adds another `Instance` root after construction. Returns `this` for chaining.

#### `addClass(ctor)`

Registers a single test class. Returns `this`.

```ts
new TestRunner().addClass(TestSum).addClass(TestProduct).run();
```

#### `run(options?)`

Runs every registered class. Returns a `Promise<TestRunResult>` that
resolves once every class is done. Default behavior prints the summary via
`print` (Roblox) or stdout (Lune).

```ts
await new TestRunner([root]).run({
	tags: ["smoke"],
	reporter: { onTestPassed(name) { print("PASSED:", name); } },
});
```

`TestRunOptions`:

| Field      | Type            | Notes                                                        |
| ---------- | --------------- | ------------------------------------------------------------ |
| `tags`     | `string[]`      | Run only tests whose tag (or class tag) overlaps these.       |
| `reporter` | `Reporter`      | Override per-test and per-run callbacks. See [Reporter](#reporter). |

`TestRunResult`:

| Field              | Type                                            | Notes                                            |
| ------------------ | ----------------------------------------------- | ------------------------------------------------ |
| `numTests`         | `number`                                        | Total invocations (parameterized rows count).    |
| `numTestsPassed`   | `number`                                        |                                                  |
| `numTestsFailed`   | `number`                                        |                                                  |
| `numTestsSkipped`  | `number`                                        |                                                  |
| `elapsedTimeMs`    | `number`                                        | Sum across all tests.                            |
| `tags`             | `string[] \| undefined`                         | Echoes the `tags` filter, if any.                |
| `tests`            | `Map<TestClassConstructor, TestClassRunResult>` | Per-class breakdown. Key is the class constructor. |

`TestClassRunResult` is the same shape minus `tags` and `tests`, plus a
`tests: TestCaseResult[]` field.

`TestCaseResult`:

| Field           | Type                                | Notes                                                  |
| --------------- | ----------------------------------- | ------------------------------------------------------ |
| `method`        | `Method`                            | Internal method record (name, options).                |
| `label`         | `string`                            | Resolved display name with parameterization suffix.    |
| `passed`        | `boolean`                           |                                                        |
| `skipped`       | `boolean`                           |                                                        |
| `errorMessage`  | `string \| undefined`               | Failure or skip reason.                                |
| `elapsedTimeMs` | `number`                            |                                                        |
| `caseIndex`     | `number \| undefined`               | Set for `@Each` rows.                                  |
| `caseArgs`      | `ReadonlyArray<unknown> \| undefined` | Set for `@Each` rows.                                |

## Decorators

See the [Decorators guide](/guides/decorators) for usage. Quick reference:

| Decorator           | Target          | Purpose                                  |
| ------------------- | --------------- | ---------------------------------------- |
| `@Test`             | method          | Mark as a test case                      |
| `@BeforeEach` / `@Before`  | method   | Run before each test                     |
| `@AfterEach` / `@After`    | method   | Run after each test                      |
| `@BeforeAll`        | method          | Run once before all tests                |
| `@AfterAll`         | method          | Run once after all tests                 |
| `@Disabled(msg?)`   | method or class | Skip with optional message               |
| `@Skip(cond, msg?)` | method or class | Skip if condition is truthy              |
| `@DisplayName(s)`   | method or class | Override report label                    |
| `@Order(n)`         | method or class | Sort key (lower runs first)              |
| `@Tag(...names)`    | method or class | Tag for `tags` filtering                 |
| `@Only`             | method or class | Focus mode                               |
| `@Each(rows)`       | method          | Parameterized — runs once per row        |
| `@Retry(n)`         | method          | Retry up to `n` times on failure         |
| `@Repeat(n)`        | method          | Run `n` times; any failure fails the test |
| `@Timeout(ms)`      | method          | Fail if not done within `ms`              |
| `@Negated`          | method          | Flip pass/fail                           |

## `Assert`

Throws on failure. Every method takes an optional last argument that's
either a `string` or a `() => string` lazy message.

### Equality

| Method                                       | Notes                                                         |
| -------------------------------------------- | ------------------------------------------------------------- |
| `Assert.equal(actual, expected, msg?)`       | Strict (`===`).                                               |
| `Assert.notEqual(actual, expected, msg?)`    | Strict inequality.                                             |
| `Assert.deepEqual(actual, expected, msg?)`   | Recursive table comparison; reports per-path diffs on failure. |
| `Assert.notDeepEqual(actual, expected, msg?)`| Inverse of `deepEqual`.                                       |

### Booleans & nil

| Method                                | Notes                                  |
| ------------------------------------- | -------------------------------------- |
| `Assert.true(actual, msg?)`           | Strictly `true` (not just truthy).     |
| `Assert.false(actual, msg?)`          | Strictly `false`.                      |
| `Assert.undefined(actual, msg?)`      | Equals `undefined` / `nil`.            |
| `Assert.notUndefined(actual, msg?)`   | Anything other than `undefined`.       |

### Numbers

| Method                                                    | Notes                                |
| --------------------------------------------------------- | ------------------------------------ |
| `Assert.greaterThan(actual, threshold, msg?)`             |                                      |
| `Assert.greaterThanOrEqual(actual, threshold, msg?)`      |                                      |
| `Assert.lessThan(actual, threshold, msg?)`                |                                      |
| `Assert.lessThanOrEqual(actual, threshold, msg?)`         |                                      |
| `Assert.between(actual, min, max, msg?)`                  | Inclusive on both ends.              |
| `Assert.approximately(actual, expected, epsilon?, msg?)`  | Default epsilon `1e-6`.              |

### Arrays

| Method                                                              | Notes                                                |
| ------------------------------------------------------------------- | ---------------------------------------------------- |
| `Assert.empty(array, msg?)`                                         |                                                      |
| `Assert.notEmpty(array, msg?)`                                      |                                                      |
| `Assert.contains(array, valueOrPredicate, msg?)`                    | Predicate form: `(el) => boolean`.                   |
| `Assert.doesNotContain(array, valueOrPredicate, msg?)`              | Same shape as `contains`.                            |

### Strings

| Method                                       | Notes                              |
| -------------------------------------------- | ---------------------------------- |
| `Assert.match(actual, pattern, msg?)`        | Lua pattern.                       |
| `Assert.startsWith(actual, prefix, msg?)`    |                                    |
| `Assert.endsWith(actual, suffix, msg?)`      |                                    |

### Throwing

| Method                                                        | Notes                                                                                  |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `Assert.throws(callback, expectedSubstring?, msg?)`           | If `expectedSubstring` is given, also asserts the thrown message contains it.          |
| `Assert.doesNotThrow(callback, msg?)`                         |                                                                                        |
| `Assert.fail(msg?)`                                           | Always throws — useful in unreachable branches.                                        |

### Promises

| Method                                                          | Notes                                  |
| --------------------------------------------------------------- | -------------------------------------- |
| `Assert.resolves(promise, msg?)`                                | Synchronously waits via `awaitStatus`. |
| `Assert.rejects(promise, msg?)`                                 |                                        |
| `Assert.timeout(promise, durationMs, msg?)`                     | Returns a `Promise<void>`.             |

## `Runtime`

Detects the host runtime. Pair with `@Skip` for runtime-specific tests.

```ts
import { Runtime } from "@rbxts/lunit";

Runtime.isRoblox(); // true under Studio / live game
Runtime.isLune();   // true under Lune
```

Detection is by global `game`: present-as-`Instance` ⇒ Roblox; otherwise
treated as non-Roblox.

## Reporter

Override the runner's per-test and per-run callbacks. Every field is
optional — provide only what you care about. Pass via `run({ reporter: ... })`.

```ts
interface Reporter {
	onRunStart?(): void;
	onRunEnd?(): void;
	onTestStart?(testName: string): void;
	onTestEnd?(testName: string, result: TestCaseResult): void;
	onTestPassed?(testName: string): void;
	onTestSkipped?(testName: string, reason?: string): void;
	onTestFailed?(testName: string, error?: string): void;
	getReport?(report: TestRunResult): string;
	output?(text: string): void;
}
```

Notable hooks:

-   **`output`** — replaces the default `print` call for the final summary.
    Pass `output() {}` to silence the run, or pipe to a file/socket.
-   **`getReport`** — replaces the default formatter entirely; receives the
    full `TestRunResult` and returns a `string` for `output`.
