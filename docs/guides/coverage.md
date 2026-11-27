---
outline: deep
---

# Coverage

Lunit measures line coverage of your TypeScript: which lines your tests ran,
and which they did not. It works under Lune and in Roblox Studio.

```plaintext
Coverage (lines)
    80.0%      20/25  src/shared/shop.ts  missed: 33-35, 43
   100.0%        4/4  src/shared/util.ts
  Total 82.8% (24/29 lines)
```

## How it works

A roblox-ts transformer, `@rbxts/lunit/transformer`, puts a counter in front
of each statement while roblox-ts compiles. The counters record the
TypeScript line numbers, so the report points at your `.ts` files, not at
the compiled Luau.

You use the transformer in a separate coverage build. Your normal build does
not change.

## Set up

Add a `tsconfig.coverage.json` next to your `tsconfig.json`:

```json
{
	"extends": "./tsconfig.json",
	"compilerOptions": {
		"plugins": [{ "transform": "@rbxts/lunit/transformer" }]
	}
}
```

Test files (`*.test.ts`, `*.spec.ts`) are not measured. To leave out other
files, give regular expressions for their paths:

```json
"plugins": [{ "transform": "@rbxts/lunit/transformer", "exclude": ["\\.(test|spec)\\.tsx?$", "^src/client/"] }]
```

`exclude` replaces the default list, so include the test pattern if you
still want test files left out.

## Under Lune

Build with the coverage config, then run with `--coverage`:

```bash
rbxtsc -p tsconfig.coverage.json
npx lunit --coverage
```

The runner prints the summary after the test report and writes
`coverage/lcov.info`. Most coverage tools read lcov, for example
[Codecov](https://codecov.io) and the
[Coverage Gutters](https://marketplace.visualstudio.com/items?itemName=ryanluker.vscode-coverage-gutters)
VS Code extension, which marks covered lines in the editor.

A `package.json` script:

```json
{
	"scripts": {
		"test": "rbxtsc && lunit",
		"test:coverage": "rbxtsc -p tsconfig.coverage.json && lunit --coverage"
	}
}
```

Add `coverage/` to your `.gitignore`.

## In Roblox Studio

Sync the coverage build to Studio with Rojo as usual, then pass
`coverage: true` to `run`:

```ts
new TestRunner([ReplicatedStorage.FindFirstChild("Tests")]).run({ coverage: true });
```

The summary prints in the Output window after the test report. Studio
cannot write files, so there is no `lcov.info`. The data is also in the
result as `result.coverage`; see [`Coverage`](/api-reference#coverage).

The server and the client keep separate counts. Each reports only the code
that ran on its side.

## Switching builds

roblox-ts rebuilds every file when you change between `tsconfig.json` and
`tsconfig.coverage.json`, so `out/` never mixes the two builds. Do not
publish or ship a coverage build: run your normal build first.

## What counts as a line

- A line counts if a statement starts on it. Lines with no code (comments,
  types, `else`, closing braces) are not in the report.
- A line is covered if a statement that starts on it ran at least once. With
  two statements on one line, one of them is enough.
- An `else if (...)` condition counts as part of its body: if the condition
  is checked but the body does not run, the line is missed.
- Parts of expressions are not counted: arrow functions without braces
  (`(x) => x * 2`), `a ? b : c`, `&&` / `||`, and class property
  initializers.
- In the summary, missed lines next to each other in the report join one
  range. `33-35` can include a line with no code, such as a `default:` label.
- A file that no test loads is not in the report, so it does not lower the
  total.
