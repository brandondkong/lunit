import {
	Annotation,
	Constructor,
	Metadata,
	TestMethod,
	DEFAULT_ORDER,
	Environment,
	TestRunOptions,
	TestCaseResult,
	TestClassConstructor,
} from "./common";
import { arrayToString, flatten, getValuesFromMap, sharesOneElement } from "./utils/array-utils";
import { getDescendantsOfType } from "./utils/instance-utils";
import StringBuilder from "./utils/string-builder";
import { getAnnotation, getClassMetadata, hasMetadata } from "./utils/metadata";

type TestClassInstance = Record<string, Callback>;

const RUN_SERVICE = game.GetService("RunService");
const IS_CLIENT = RUN_SERVICE.IsClient();

type TestClassType = {
	[Metadata.TestList]: Map<string, TestMethod>;
	[key: string]: unknown;
};

export class TestRunner {
	private readonly testClasses: [TestClassConstructor, TestClassInstance][];
	private results: Map<TestClassConstructor, Map<TestMethod, TestCaseResult>>;

	private failedTests: number = 0;
	private passedTests: number = 0;
	private skippedTests: number = 0;

	private options: TestRunOptions = {};

	private resetResults(): void {
		this.results.clear();
		this.failedTests = 0;
		this.passedTests = 0;
		this.skippedTests = 0;
	}

	public constructor(roots: Instance[]) {
		this.testClasses = new Array<[TestClassConstructor, TestClassInstance]>();
		this.results = new Map<TestClassConstructor, Map<TestMethod, TestCaseResult>>();

		const modules = flatten(roots.map((root) => getDescendantsOfType(root, "ModuleScript")));
		for (const module of modules) {
			const testClass = <Constructor>require(module);
			this.addClass(testClass);
		}
	}

	private addClass(ctor: Constructor): void {
		if (ctor === undefined || (ctor as unknown as { new: unknown }).new === undefined) return;

		/*
		if (this.options.tags !== undefined) {
			const classMetadata = getClassMetadata(ctor);
			if (!sharesOneElement(this.options.tags, classMetadata?.tags ?? [])) {
				return;
			}
		}
		*/

		const testClass = <TestClassConstructor>ctor;
		const newClass = <TestClassInstance>new ctor();

		this.testClasses.push([testClass, newClass]);
	}

	public async run(options?: TestRunOptions): Promise<Map<TestClassConstructor, Map<TestMethod, TestCaseResult>>> {
		// multiple runs don't accumulate total tests
		this.options = options ?? {};

		this.resetResults();

		const start = os.clock();

		this.options.reporter?.onRunStart(this.testClasses.size());

		for (const [testClass, testClassInstance] of this.testClasses) {
			await this.runTestClass(testClass, testClassInstance, options);
		}

		const elapsedTime = os.clock() - start;

		this.options.reporter?.onRunEnd(elapsedTime);
		print(this.generateOutput(elapsedTime));

		return this.results;
	}

	private getTestsFromTestClass(testClass: TestClassConstructor, tags: string[]): ReadonlyArray<TestMethod> {
		if (hasMetadata(testClass, Metadata.TestList) === false) return [];
		const list: Map<string, TestMethod> = (testClass as unknown as TestClassType)[Metadata.TestList];

		return getValuesFromMap(list)
			.filter((val) => {
				if (val.options.isATest !== true) return false;
				if (tags.size() > 0) {
					const classMetadata = getClassMetadata(testClass);

					const methodTags = val.options.tags ?? [];
					const classTags = classMetadata?.tags ?? [];

					return sharesOneElement(tags, classTags) || sharesOneElement(tags, methodTags);
				}
				return true;
			})
			.sort((a, b) => (a.options.order ?? DEFAULT_ORDER) < (b.options.order ?? DEFAULT_ORDER));
	}

	private async runTestClass(
		testClass: TestClassConstructor,
		testClassInstance: TestClassInstance,
		options?: TestRunOptions,
	): Promise<Promise<void>[]> {
		const testClassMetadata = getClassMetadata(testClass);

		const addResult = (test: TestMethod, result: Omit<TestCaseResult, "classInstance" | "className">) => {
			let classResults = this.results.get(testClass);
			if (classResults === undefined) {
				const newMap = new Map<TestMethod, TestCaseResult>();
				this.results.set(testClass, newMap);
				classResults = newMap;
			}

			const isNegated = test.options.negated;

			const newResult: TestCaseResult = {
				passed: isNegated === true && result.skipped === false ? !result.passed : result.passed,
				timeElapsed: result.timeElapsed,
				skipped: result.skipped,
				className: testClassMetadata?.displayName ?? tostring(testClass),
				classInstance: testClassInstance,
				errorMessage:
					isNegated === true
						? !result.passed === true && result.skipped !== true
							? ""
							: "Test was marked as a negative test and unexpectedly did not error"
						: result.errorMessage,
			};

			classResults.set(test, newResult);

			switch (newResult.passed) {
				case true:
					this.passedTests++;
					this.options.reporter?.onTestPassed(test.options.displayName ?? test.name);
					break;
				case false:
					if (newResult.skipped === true) {
						this.skippedTests++;
						this.options.reporter?.onTestSkipped(
							test.options.displayName ?? test.name,
							newResult.errorMessage,
						);
					} else {
						this.failedTests++;
						this.options.reporter?.onTestFailed(
							test.options.displayName ?? test.name,
							newResult.errorMessage,
						);
					}
			}

			this.options.reporter?.onTestEnd(test.options.displayName ?? test.name, newResult);
		};

		const handleTestResult = async (test: TestMethod, callback: Callback) => {
			const start = os.clock();
			const timeout = test.options.timeout;

			try {
				if (timeout !== undefined) {
					const [status] = Promise.try(callback)
						.timeout(timeout / 1000)
						.awaitStatus();

					const timeElapsed = os.clock() - start;
					if (status === "Resolved") {
						addResult(test, { passed: true, timeElapsed, skipped: false });
					} else {
						addResult(test, {
							passed: false,
							timeElapsed,
							skipped: false,
							errorMessage: `Test exceeded timeout of ${timeout}ms`,
						});
					}
				} else {
					await callback();
					const timeElapsed = os.clock() - start;
					addResult(test, { passed: true, timeElapsed, skipped: false });
				}
			} catch (e) {
				const timeElapsed = os.clock() - start;
				addResult(test, {
					passed: false,
					errorMessage: tostring(e),
					timeElapsed,
					skipped: false,
				});
			}
		};

		const skipTest = async (test: TestMethod, reason: string = "") => {
			addResult(test, { passed: false, skipped: true, timeElapsed: 0, errorMessage: reason });
		};

		const testList = this.getTestsFromTestClass(testClass, options?.tags ?? []);

		await this.runAnnotatedMethods(testClass, testClassInstance, Annotation.BeforeAll);

		const testPromises: Promise<void>[] = [];
		for (const test of testList) {
			await this.runAnnotatedMethods(testClass, testClassInstance, Annotation.BeforeEach);

			if (test.options.disabled?.value === true) {
				skipTest(test, test.options.disabled.message);
				continue;
			}

			// If the function should run on either the client or server, skip it if it's ran on another boundary
			if (test.options.environment !== undefined) {
				const testEnvironment = test.options.environment;
				if (!this.testIsOnRightEnvironment(testEnvironment)) {
					skipTest(test, `Test needs to run on ${test.options.environment} environment`);
					continue;
				}
			}

			const callback = <Callback>(testClass as unknown as TestClassType)[test.name];
			await handleTestResult(test, () => callback(testClassInstance)).catch(() => {});

			await this.runAnnotatedMethods(testClass, testClassInstance, Annotation.AfterEach);
		}

		await this.runAnnotatedMethods(testClass, testClassInstance, Annotation.AfterAll);

		return testPromises;
	}

	private async runAnnotatedMethods(
		testClass: TestClassConstructor,
		testClassInstance: TestClassInstance,
		annotation: Annotation,
	): Promise<void> {
		return Promise.try(async () => {
			const afterAllCallback = getAnnotation(testClass, annotation);
			for (const callback of afterAllCallback) {
				await Promise.try(() => callback(testClassInstance)).catch(() => {});
			}
		}).catch(() => {});
	}

	private generateOutput(elapsedTime: number): string {
		const results = new StringBuilder("\n\n");

		const getSymbol = (passed: boolean, skipped?: boolean) => (skipped === true ? "⏭️" : passed ? "✅" : "❌");

		const totalTestsRan = this.failedTests + this.passedTests + this.skippedTests;

		if (this.options.tags !== undefined) {
			results.appendLine(`Ran filtered tests on the following tags: ${arrayToString(this.options.tags)}`);
			results.appendLine("");
		}

		if (totalTestsRan === 0) {
			results.appendLine("No tests ran.");
			return results.toString();
		}

		const formatTestResult = (testResult: [TestMethod, TestCaseResult], isLast: boolean) => {
			const [testCaseMetadata, testCase] = testResult;

			const passed = testCase.passed;
			const skipped = testCase.skipped;
			const failed = !(passed || skipped);

			const isDisabled = testCaseMetadata.options.disabled?.value || false;
			const disabledMessage = testCaseMetadata.options.disabled?.message ?? "";

			const timeElapsed = testCase.timeElapsed;

			results.append(" │");

			results.appendLine(
				`\t${isLast ? "└" : "├"}── [${getSymbol(passed, skipped)}] ${testCaseMetadata.options.displayName ?? testCaseMetadata.name} (${math.round(timeElapsed * 1000)}ms) ${passed ? "PASSED" : failed ? "FAILED" : isDisabled ? `SKIPPED${disabledMessage.size() > 0 ? ` (${disabledMessage})` : ""}` : `SKIPPED${testCaseMetadata.options.environment !== undefined ? ` (not running on ${testCaseMetadata.options.environment})` : ""}`}`,
			);
		};

		this.results.forEach((testResultsRecord, testClass) => {
			const testClassMetadata = getClassMetadata(testClass);
			const className = testClassMetadata?.displayName ?? (testClass as unknown as string);

			const testResults: [TestMethod, TestCaseResult][] = [];
			testResultsRecord.forEach((value, key) => {
				testResults.push([key, value]);
			});

			const someTestsFailed = testResults.some(([_, cases]) => cases.passed === false && cases.skipped === false);
			const totalTimeElapsed = testResults.map(([_, val]) => val.timeElapsed).reduce((sum, n) => sum + n);

			results.appendLine(
				`[${getSymbol(!someTestsFailed)}] ${className} (${math.round(totalTimeElapsed * 1000)}ms)`,
			);

			testResults.forEach((testResult, index) => {
				formatTestResult(testResult, index === testResults.size() - 1);
			});

			results.appendLine("");
		});

		if (this.failedTests > 0) {
			results.appendLine("Failures:");

			let failureIndex = 0;

			for (const [className, testResults] of pairs(this.results)) {
				for (const [testCaseName, { errorMessage, passed }] of pairs(testResults)) {
					if (passed === true || errorMessage === undefined) continue;
					results.appendLine(`${++failureIndex}. ${className}.${testCaseName.name}`);

					const errorDisplay = tostring(errorMessage)
						.split("\n")
						.map((line) => "   " + line)
						.join("\n\t");
					results.appendLine(errorDisplay);
					results.appendLine("");
				}
			}
		}

		const totalTests = this.passedTests + this.failedTests;
		results.appendLine("");
		results.appendLine(`\tRan ${totalTests} tests in ${math.round(elapsedTime * 1000)}ms`);
		results.appendLine(`\t\tPassed: ${this.passedTests}`);
		results.appendLine(`\t\tFailed: ${this.failedTests}`);
		results.appendLine(`\t\tSkipped: ${this.skippedTests}`);
		results.appendLine("");

		return results.toString();
	}

	private testIsOnRightEnvironment(environment: Environment): boolean {
		return (
			(IS_CLIENT === true && environment === Environment.Client) ||
			(IS_CLIENT === false && environment === Environment.Server)
		);
	}
}
