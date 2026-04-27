import { Lifecycle } from "../shared/enums";
import { addTagsToMetadata } from "../shared/utils";
import { createSharedDecorator, createMethodDecorator } from "./utils";

/**
 * Marks a method as a test case.
 * @example
 * ```typescript
 * @Test
 * public myTest() {
 *   // test code here
 * }
 * ```
 */
export const Test = createMethodDecorator((metadata) => (metadata.isTest = true));

/**
 * Disables a test case or test class.
 * @param message - An optional message explaining why the test is disabled.
 * @example
 * ```typescript
 * @Disabled("This test is temporarily disabled")
 * public myTest() {
 *   // test code here
 * }
 * ```
 */
export const Disabled = (message?: string) =>
	createSharedDecorator((metadata) => (metadata.disabled = { value: true, message }));

/**
 * Sets a display name for a test case or test class.
 * @param name - The display name to use.
 * @example
 * ```typescript
 * @DisplayName("My Custom Test Name")
 * public myTest() {
 *   // test code here
 * }
 * ```
 */
export const DisplayName = (name: string) => createSharedDecorator((metadata) => (metadata.displayName = name));

/**
 * Sets a timeout for a test case.
 * @param timeInMilliseconds - The timeout duration in milliseconds.
 * @example
 * ```typescript
 * @Timeout(1000)
 * public myTest() {
 *   // test code here
 * }
 * ```
 */
export const Timeout = (timeInMilliseconds: number) =>
	createMethodDecorator((metadata) => (metadata.timeout = timeInMilliseconds));

/**
 * Sets the order in which a test case should be run.
 * @param order - The order index.
 * @example
 * ```typescript
 * @Order(1)
 * public myTest() {
 *   // test code here
 * }
 * ```
 */
export const Order = (order: number) => createSharedDecorator((metadata) => (metadata.order = order));

/**
 * Marks a method to be run before each test case.
 * @alias Before
 * @example
 * ```typescript
 * @BeforeEach
 * public setup() {
 *   // setup code here
 * }
 * ```
 */
export const BeforeEach = createMethodDecorator((metadata) => metadata.lifecycles.push(Lifecycle.RunBeforeEachTest));

/**
 * Marks a method to be run before each test case.
 * @example
 * ```typescript
 * @Before
 * public setup() {
 *   // setup code here
 * }
 * ```
 */
export const Before = BeforeEach;

/**
 * Marks a method to be run before all test cases.
 * @example
 * ```typescript
 * @BeforeAll
 * public setupAll() {
 *   // setup code here
 * }
 * ```
 */
export const BeforeAll = createMethodDecorator((metadata) => metadata.lifecycles.push(Lifecycle.RunBeforeAllTests));

/**
 * Marks a method to be run after each test case.
 * @example
 * ```typescript
 * @After
 * public teardown() {
 *   // teardown code here
 * }
 * ```
 */
export const After = createMethodDecorator((metadata) => metadata.lifecycles.push(Lifecycle.RunAfterEachTest));

/**
 * Marks a method to be run after each test case.
 * @example
 * ```typescript
 * @AfterEach
 * public teardown() {
 *   // teardown code here
 * }
 * ```
 */
export const AfterEach = createMethodDecorator((metadata) => metadata.lifecycles.push(Lifecycle.RunAfterEachTest));

/**
 * Marks a method to be run after all test cases.
 * @example
 * ```typescript
 * @AfterAll
 * public teardownAll() {
 *   // teardown code here
 * }
 * ```
 */
export const AfterAll = createMethodDecorator((metadata) => metadata.lifecycles.push(Lifecycle.RunAfterAllTests));

/**
 * Assigns one or more tags to a test case or test class for filtering and categorization.
 *
 * Tags allow selective execution of test cases, making it easier to run specific groups of tests
 * (e.g., regression, smoke, or critical tests).
 *
 * @param tags - One or more string tags associated with the test.
 *
 * @example
 * ```typescript
 * @Tag("Regression")
 * public myTest() {
 *   // This test belongs to the "Regression" category
 * }
 *
 * @Tag("Smoke", "Critical")
 * public anotherTest() {
 *   // This test belongs to both "Smoke" and "Critical" categories
 * }
 * ```
 */
export const Tag = (...args: string[]) => createSharedDecorator((metadata) => addTagsToMetadata(metadata, ...args));

/**
 * Flips the result of a test case. If the test case would normally pass, it will be marked as failed, and if it would normally fail, it will be marked as passed.
 *
 * This is useful for testing the behavior of test runners and reporters.
 * @example
 * ```typescript
 * @Test
 * @Negated
 * public myTest() {
 *   // test code here
 * }
 * ```
 */
export const Negated = createMethodDecorator((metadata) => (metadata.negated = true));

/**
 * Conditionally skips a test case or test class.
 * @param condition - A boolean condition or a function returning a boolean to determine if the test should be skipped.
 * @param message - An optional message explaining why the test is skipped.
 * @example
 * ```typescript
 * @Skip(process.env.NODE_ENV === 'production', "Skip in production environment")
 * public myTest() {
 *   // test code here
 * }
 * ```
 */
export const Skip = (condition: boolean | (() => boolean), message?: string) =>
	createSharedDecorator((metadata) => {
		metadata.disabled = {
			value: typeIs(condition, "boolean") ? condition : condition(),
			message,
		};
	});

/**
 * Focuses execution on a specific test case or test class. When any test or class is marked `@Only`,
 * only those marked are run. Method-level focus narrows within a class; class-level focus narrows
 * across the whole run.
 * @example
 * ```typescript
 * @Only
 * @Test
 * public theOneIcareAbout() {
 *   // only this test will run if any test has @Only
 * }
 * ```
 */
export const Only = createSharedDecorator((metadata) => (metadata.only = true));

/**
 * Runs a single test method once per row, with the row's values spread as arguments.
 * Each row produces an independent test result.
 * @param rows - An array of argument tuples to invoke the test with.
 * @example
 * ```typescript
 * @Each([
 *   [1, 2, 3],
 *   [10, 20, 30],
 * ])
 * @Test
 * public addition(a: number, b: number, expected: number) {
 *   Assert.equal(a + b, expected);
 * }
 * ```
 */
export const Each = (rows: ReadonlyArray<ReadonlyArray<unknown>>) =>
	createMethodDecorator((metadata) => (metadata.cases = rows));

export default {
	// Test property decorators
	Test,
	Disabled,
	DisplayName,
	Timeout,
	Order,
	Tag,
	Negated,
	Skip,
	Only,
	Each,

	// Test execution lifecycle decorators
	Before,
	BeforeAll,
	BeforeEach,
	After,
	AfterEach,
	AfterAll,
};
