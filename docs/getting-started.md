---
outline: deep
---

# Getting Started

## Introduction

Welcome to the documentation for `@rbxts/lunit`! This library is a robust TypeScript testing library for Roblox-TS projects. It provides an intuitive and lightweight assertion system, making it easy to write and understand tests.

## Installation

To get started with `@rbxts/lunit`, you can install it via npm:

```bash
npm install @rbxts/lunit
```

## Usage

Here's a simple example of how you can use `@rbxts/lunit` to write tests for your Roblox-TS projects:

First, create your test file that contains your test cases:

```ts
// ReplicatedStorage/Tests/TestSum.spec.ts
import { Test, Assert } from "@rbxts/lunit";

class TestSum {
	@Test
	public addsTwoNumbers() {
		Assert.equals(1 + 1, 2);
	}
}

export = TestSum;
```

Next, create a test runner script that runs your test cases:

```ts
// TestRunner.server.ts OR TestRunner.client.ts
import { TestRunner } from "@rbxts/lunit";;

const testRunner = new TestRunner([
    // all instances whose descendants are tests
    game.GetService("ReplicatedStorage").FindFirstChild("Tests"),

    // add more instances if you have more tests
    ...
]);

testRunner.run();
```

Running the test runner script will output the results of your test cases in the Roblox Studio output window.

```plaintext
[✅] TestSum (0ms)
  │   └── [✅] addsTwoNumbers (0ms) PASSED

...
```

That's it! You've successfully written and run your first test case using `@rbxts/lunit`.

## Next Steps

Ready to get started? Check out the [API Reference](/api-reference) to learn more about the available APIs and features of `@rbxts/lunit`.

## Resources

- [GitHub Repository](https://github.com/brandon-kong/lunit)
- [NPM Package](https://www.npmjs.com/package/@rbxts/lunit)

## License

This project is licensed under the MIT License.
