import { MetadataKey } from "../shared/enums";
import { Method } from "../shared/types";
import { CoverageReport } from "../coverage";

export type Constructor<T = object> = new (...args: never[]) => T;
export type TestClassInstance = object;
export type TestClassConstructor = Constructor<TestClassInstance>;

export type TestRunOptions = {
	/** Run only tests that have at least one of these tags, on the test or on its class. */
	tags?: string[];
	/** Leave out tests that have any of these tags, on the test or on its class. */
	excludeTags?: string[];
	/**
	 * Run only tests whose name contains this text. The name is `Class.method`;
	 * display names set with `@DisplayName` match too. Case-sensitive.
	 */
	filter?: string;
	/** Stop after the first failing test. Tests after it are not run or reported. */
	bail?: boolean;
	/**
	 * After the report, print line coverage and add it to the result. Needs a
	 * build made with the Lunit transformer (`@rbxts/lunit/transformer`).
	 */
	coverage?: boolean;
	reporter?: Reporter;
};

interface BaseTestRunResult {
	elapsedTimeMs: number;
	numTests: number;
	numTestsPassed: number;
	numTestsFailed: number;
	numTestsSkipped: number;
}

export interface TestClassRunResult extends BaseTestRunResult {
	tests: TestCaseResult[];
}

export interface TestRunResult extends BaseTestRunResult {
	tags?: string[];
	tests: Map<TestClassConstructor, TestClassRunResult>;
	/** Line coverage, when the run used `coverage: true` and coverage data exists. */
	coverage?: CoverageReport;
}

/** What `TestRunner.describe` returns: the tests a run with the same options would run. */
export interface TestPlan {
	classes: TestPlanClass[];
	/** Total invocations, counting each `@Each` row. */
	numTests: number;
}

export interface TestPlanClass {
	/** The class itself; the same key as in `TestRunResult.tests`. */
	testClass: TestClassConstructor;
	/** The class name. */
	name: string;
	/** `@DisplayName`, or the class name. */
	displayName: string;
	tags: string[];
	/** Set when the whole class will be skipped: `@Disabled`, `@Skip`, or a runtime tag for the other runtime. */
	skipReason?: string;
	tests: TestPlanTest[];
}

export interface TestPlanTest {
	/** The method name. */
	name: string;
	/** `@DisplayName`, or the method name. */
	displayName: string;
	/** The test's own tags. The class's tags are on the class. */
	tags: string[];
	/** One label per `@Each` row, as in `TestCaseResult.label`. Empty when the test is not parameterized. */
	cases: string[];
	/** Set when the test will be skipped. */
	skipReason?: string;
}

export interface TestCaseResult {
	method: Method;
	/**
	 * The resolved display name for reporting. Equals `method.options.displayName ?? method.name`,
	 * with a case suffix appended for parameterized tests (e.g. `addition (1, 2, 3)`).
	 */
	label: string;
	passed: boolean;
	errorMessage?: string;
	elapsedTimeMs: number;
	skipped: boolean;
	/** Index of the case row when the test is parameterized via `@Each`. Undefined otherwise. */
	caseIndex?: number;
	/** Args used for this invocation when the test is parameterized via `@Each`. Undefined otherwise. */
	caseArgs?: ReadonlyArray<unknown>;
}

export interface Reporter {
	onRunStart?(): void;
	onRunEnd?(): void;

	onTestStart?(testName: string): void;
	onTestEnd?(testName: string, result: TestCaseResult): void;

	onTestPassed?(testName: string): void;
	onTestSkipped?(testName: string, reason?: string): void;
	onTestFailed?(testName: string, error?: string): void;

	getReport?: (report: TestRunResult) => string;
	output?: (text: string) => void;
}

export interface TestClass extends Record<string, unknown> {
	[MetadataKey.Method]: Map<string, Method>;
}
