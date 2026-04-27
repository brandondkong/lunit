[NPM Registry](https://npmjs.org/@rbxts/lunit)

# @rbxts/lunit

@rbxts/lunit is a testing library for Roblox TypeScript projects, providing a simple and efficient way to write and run tests.

## Features

- **Easy to Use**: Simple and intuitive API for writing tests.
- **TypeScript Support**: Fully supports TypeScript, making it easy to write and maintain tests.
- **Integration with Roblox**: Designed specifically for Roblox projects, ensuring seamless integration.
- **Customizable Reporters**: Built-in support for custom reporters to format test results as needed.
- **Comprehensive Assertions**: Provides a wide range of assertions to validate your code.
- **Define Testing Criteria**: Using native Typescript Decorators, you can define criteria/properties for each of your tests, making them easier to manage and organize!

## Why Use @rbxts/lunit

- **No Dependencies**: The library has no dependencies, making it lightweight and easy to integrate with your current game or framework.
- **Robust Testing**: Comprehensive assertions and easy-to-use functions for thorough testing.
- **Minimal, But Powerful**: The syntax for writing tests is underwhelming, but it also exposes all sorts of APIs for writing flexible tests.

## Installation

To install the library, use npm:

```sh
npm install @rbxts/lunit
```

## Usage

### Writing Tests

Tests in LUnit can be defined as a simple TypeScript class. Each test is treated like a module, so you'll export the class definition as the module. Here's an example:

```typescript
// ReplicatedStorage/Tests/SomeTest.spec.ts
import { Test, DisplayName, Assert } from "@rbxts/lunit";

// this is the function we're testing
function sum(a: number, b: number): number {
	return a + b;
}

class TestClass {
	@Test
	sumTwoNums() {
		Assert.equals(sum(5, 5), 10);
		Assert.notEqual(sum(5, 5), 999);
	}
}

export = TestClass; // export the class as a module
```

### Running Tests

To run your tests, use the following npm script:

```ts
// SomeScript.server.ts
import { ReplicatedStorage } from "@rbxts/services";
import { TestRunner } from "@rbxts/lunit";

const testRunner = new TestRunner([
	ReplicatedStorage.FindFirstChild("Tests"), // the folder containing all your test modules
]);

testRunner.run();
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Author

Brandon Kong
