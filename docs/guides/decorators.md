---
outline: deep
---

# Decorators

Decorators are a way to modify or extend the behavior of functions or methods. They are a form of metaprogramming and are used to add functionality to existing code. Decorators are a powerful tool in TypeScript, and they can be used to simplify code, make it more readable, and reduce redundancy.

## Overview

### Usage

Lunit provides several decorators that can be used to define test cases and test suites. These decorators are used to mark functions as test cases or test suites and to define the behavior of the tests.

### Example

Here is an example of how you can use decorators to define test cases in Lunit:

```ts
import { Test, Assert } from "@rbxts/lunit";

class TestSum {
    @Test
    public addsTwoNumbers() {
        Assert.equals(1 + 1, 2);
    }
}

export = TestSum;
```

In this example, the `@Test` decorator is used to mark the `addsTwoNumbers` function as a test case. The `Assert.equals` function is used to check that `1 + 1` equals `2`.

## Decorators

### `@Test`

The `@Test` decorator is used to mark a function as a test case. Test cases are functions that contain the actual test logic and assertions.

```ts
class TestSum {
    @Test
    public addsTwoNumbers() {
        Assert.equals(1 + 1, 2);
    }
}
```

### `@Before`

The `@Before` decorator is used to mark a function that should be run before each test case in a test suite. This function is typically used to set up the test environment or perform any necessary setup tasks.

```ts
class TestSum {
    @Before
    public setUp() {
        // Set up the test environment
    }

    @Test
    public addsTwoNumbers() {
        Assert.equals(1 + 1, 2);
    }
}
```

---

### `@BeforeEach`

The `@BeforeEach` decorator is used to mark a function that should be run before each test case in a test suite. This function is typically used to set up the test environment or perform any necessary setup tasks.

> This has the same effect as `@Before`.

```ts
class TestSum {
    @BeforeEach
    public setUp() {
        // Set up the test environment
    }

    @Test
    public addsTwoNumbers() {
        Assert.equals(1 + 1, 2);
    }
}
```

---

### `@After`

The `@After` decorator is used to mark a function that should be run after each test case in a test suite. This function is typically used to clean up the test environment or perform any necessary teardown tasks.

```ts
class TestSum {
    @After
    public tearDown() {
        // Clean up the test environment
    }

    @Test
    public addsTwoNumbers() {
        Assert.equals(1 + 1, 2);
    }
}
```

---

### `@AfterEach`

The `@AfterEach` decorator is used to mark a function that should be run after each test case in a test suite. This function is typically used to clean up the test environment or perform any necessary teardown tasks.

> This has the same effect as `@After`.

```ts
class TestSum {
    @AfterEach
    public tearDown() {
        // Clean up the test environment
    }

    @Test
    public addsTwoNumbers() {
        Assert.equals(1 + 1, 2);
    }
}
```

---

### `@BeforeAll`

The `@BeforeAll` decorator is used to mark a function that should be run before all test cases in a test suite. This function is typically used to set up the test environment or perform any necessary setup tasks that only need to be done once.

```ts

class TestSum {
    @BeforeAll
    public static setUpAll() {
        // Set up the test environment
    }

    @Test
    public addsTwoNumbers() {
        Assert.equals(1 + 1, 2);
    }
}
```

---

### `@AfterAll`

The `@AfterAll` decorator is used to mark a function that should be run after all test cases in a test suite. This function is typically used to clean up the test environment or perform any necessary teardown tasks that only need to be done once.

```ts
class TestSum {
    @AfterAll
    public static tearDownAll() {
        // Clean up the test environment
    }

    @Test
    public addsTwoNumbers() {
        Assert.equals(1 + 1, 2);
    }
}
```

---

### `@Disabled`

The `@Disabled` decorator is used to mark a test case as disabled. Disabled test cases are not run when the test suite is executed. This can be useful when you want to temporarily disable a test case without deleting it.

This decorator takes an optional message parameter that can be used to provide a reason for disabling the test case.

```ts
class TestSum {
    @Disabled("This test case is disabled because it is not yet implemented")
    public disabledTest() {
        // This test case will not be run
    }

    @Test
    public addsTwoNumbers() {
        Assert.equals(1 + 1, 2);
    }
}
```

---

### `@DisplayName`

The `@DisplayName` decorator is used to provide a custom display name for a test case. By default, the display name of a test case is the name of the function that contains the test logic. You can use the `@DisplayName` decorator to provide a more descriptive name for the test case.

```ts
class TestSum {
    @DisplayName("Adding two numbers should return the sum")
    public addsTwoNumbers() {
        Assert.equals(1 + 1, 2);
    }
}
```

---

### `@Timeout`

The `@Timeout` decorator is used to set a timeout for a test case. If the test case takes longer than the specified timeout to complete, it will be marked as failed.

This decorator takes a timeout value in milliseconds as a parameter.

```ts
class TestSum {
    @Timeout(1000)
    public slowTest() {
        // This test case will fail if it takes longer than 1 second to complete
    }
}
```

---

### `@Negated`

The `@Negated` decorator is used to flip the result of a test case. If the test case would normally pass, it will be marked as failed, and if it would normally fail, it will be marked as passed.

```ts
class TestSum {
    @Test
    @Negated
    public notEquals() {
        Assert.notEquals(1 + 1, 3);
    } // This test case will pass 
}
```

The `@Negated` decorator can be powerful when combined with other decorators, such as [`@Timeout`](#timeout) to create complex test cases.

For example, you can use the `@Negated` decorator to create a test case that should fail if it takes longer than a certain amount of time to complete:

```ts
class TestSum {
    @Test
    @Timeout(1000)
    @Negated
    public slowTest() {
        // This test case will pass if it takes longer than 1 second to complete
    }
}
```

---

### `@Tag`

The `@Tag` decorator is used to assign tags to test cases. Tags are used to categorize test cases and make it easier to filter and run specific groups of tests.

This decorator takes one or more tag names as parameters.

```ts
class TestSum {
    @Tag("math", "addition")
    public addsTwoNumbers() {
        Assert.equals(1 + 1, 2);
    }
}
```

When running the test suite, you can use the tags to filter the test cases that you want to run:

```ts
import { TestRunner } from "@rbxts/lunit";

const testRunner = new TestRunner([
    TestSum
]);

testRunner.run({
    tags: ["math"]
});
```

In this example, only the test cases with the `math` tag will be run.

---

### `@Server`

The `@Server` decorator is used to mark a test case as a server test case. Server test cases can only be ran on the server side of the Roblox game engine. This can be useful when you want to test server-specific functionality or interactions.

```ts
class TestSum {
    @Server
    public serverTest() {
        // This test case will only run on the server side
    }
}
```

If you do not specify a test case as a server test case, it will run on either the client or server side, depending on the context in which the test suite is executed.

If you run a test suite with server test cases on the client side, the server test cases will be skipped.

---

### `@Client`

The `@Client` decorator is used to mark a test case as a client test case. Client test cases can only be ran on the client side of the Roblox game engine. This can be useful when you want to test client-specific functionality or interactions.

```ts
class TestSum {
    @Client
    public clientTest() {
        // This test case will only run on the client side
    }
}
```

If you do not specify a test case as a client test case, it will run on either the client or server side, depending on the context in which the test suite is executed.

If you run a test suite with client test cases on the server side, the client test cases will be skipped.

### `@Order`

The `@Order` decorator is used to specify the order in which test cases should be run within a test suite. By default, test cases are ran in an arbitrary order. You can use the `@Order` decorator to override this default order.

This decorator takes an order value as a parameter. Test cases are ran in ascending order of their order values.

```ts
class TestSum {
    @Order(1)
    public test1() {
        // This test case will be ran first
    }

    @Order(2)
    public test2() {
        // This test case will be ran second
    }
}
```

### `@Skip`

The `@Skip` decorator is used to skip a test case based on a condition. This can be useful when you want to skip a test case based on certain criteria, such as the environment in which the test suite is executed.

This decorator takes a `boolean` OR a `condition function` as a parameter. The condition function should return a boolean value that determines whether the test case should be skipped.

A second parameter can be provided to specify a message that explains why the test case was skipped.

```ts
const RUN_TESTS = false;

class TestSum {
    @Skip(RUN_TESTS) // This test case will be ran if RUN_TESTS is false
    public windowsOnlyTest() {
        // This test case will be skipped on Windows
    }

    @Skip(() => !RUN_TESTS, "This test case is disabled because  !RUN_TESTS is true, so it will be skipped")
    public disabledTest() {
        // This test case will be skipped
    }
}
```

#
