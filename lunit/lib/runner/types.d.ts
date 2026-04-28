import { MetadataKey } from "../shared/enums";
import { Method } from "../shared/types";

export type Constructor<T = object> = new (...args: never[]) => T;
export type TestClassInstance = object;
export type TestClassConstructor = Constructor<TestClassInstance>;

export type TestRunOptions = {
	tags?: string[];
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
