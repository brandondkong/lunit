import { getValuesFromMap, sharesOneElement } from "../../utils/array";
import { getClassMetadata, getLifecycleMethods, hasMetadata } from "../metadata/utils";
import { DEFAULT_ORDER } from "../shared/constants";
import { Lifecycle, MetadataKey } from "../shared/enums";
import { BaseMetadata, Method } from "../shared/types";
import {
	TestCaseResult,
	TestClass,
	TestClassConstructor,
	TestClassInstance,
	TestClassRunResult,
	TestRunOptions,
} from "./types";

export function resolveTestLabel(method: Method, caseArgs?: ReadonlyArray<unknown>): string {
	const baseName = method.options.displayName ?? method.name;
	if (caseArgs === undefined) return baseName;
	const parts: string[] = [];
	for (const arg of caseArgs) parts.push(tostring(arg));
	return `${baseName} (${parts.join(", ")})`;
}

export class TestClassRunner {
	private metadata: BaseMetadata;
	private instance: TestClassInstance;

	constructor(private testClassConstructor: TestClassConstructor) {
		this.metadata = getClassMetadata(this.testClassConstructor) ?? {};
		this.instance = new this.testClassConstructor();
	}

	public getConstructor(): TestClassConstructor {
		return this.testClassConstructor;
	}

	public getMetadata(): BaseMetadata {
		return this.metadata;
	}

	public async runTests(options: TestRunOptions): Promise<TestClassRunResult> {
		const testList = this.getTestsFromTestClass(options.tags ?? []);

		// LIFECYCLE:beforeAll
		await this.runLifecycleMethod(Lifecycle.RunBeforeAllTests);

		const results: TestClassRunResult = {
			elapsedTimeMs: 0,
			numTests: 0,
			numTestsPassed: 0,
			numTestsSkipped: 0,
			numTestsFailed: 0,
			tests: [],
		};
		for (const test of testList) {
			const cases = test.options.cases;
			// Sentinel is `[{}]` not `[undefined]`: Luau collapses `{ nil }` to an empty table,
			// so a non-parameterized test would never run.
			const invocations: ReadonlyArray<{ args?: ReadonlyArray<unknown>; index?: number }> =
				cases !== undefined && cases.size() > 0 ? cases.map((args, index) => ({ args, index })) : [{}];

			for (const invocation of invocations) {
				const result = await this.runWithRepeatAndRetry(test, options, invocation.args, invocation.index);
				results.elapsedTimeMs += result.elapsedTimeMs;
				results.numTests++;
				if (result.passed) results.numTestsPassed++;
				else if (result.skipped) results.numTestsSkipped++;
				else results.numTestsFailed++;
				results.tests.push(result);
			}
		}

		// LIFECYCLE:afterAll
		await this.runLifecycleMethod(Lifecycle.RunAfterAllTests);
		return results;
	}

	private async runLifecycleMethod(lifecycle: Lifecycle): Promise<void> {
		return Promise.try(async () => {
			const methods = getLifecycleMethods(this.testClassConstructor, lifecycle);
			for (const callback of methods) {
				await Promise.try(() => callback(this.instance)).catch((e) => {
					warn(tostring(e));
				});
			}
		});
	}

	private getTestsFromTestClass(tags: string[]): ReadonlyArray<Method> {
		if (hasMetadata(this.testClassConstructor, MetadataKey.Method) === false) return [];
		const methods = (this.testClassConstructor as unknown as TestClass)[MetadataKey.Method];

		const filtered = getValuesFromMap(methods)
			.filter((val) => val.options.isTest)
			.filter((val) => {
				if (tags.size() > 0) {
					const methodTags = val.options.tags ?? [];
					const classTags = this.metadata?.tags ?? [];

					return sharesOneElement(tags, classTags) || sharesOneElement(tags, methodTags);
				}
				return true;
			});

		const focused = filtered.filter((val) => val.options.only);
		const candidates = focused.size() > 0 ? focused : filtered;

		return candidates.sort((a, b) => (a.options.order ?? DEFAULT_ORDER) < (b.options.order ?? DEFAULT_ORDER));
	}

	private createFinalTestCaseResult(result: TestCaseResult): TestCaseResult {
		const isNegated = result.method.options.negated;

		result.passed = isNegated && !result.skipped ? !result.passed : result.passed;
		result.errorMessage = isNegated
			? !(result.passed || result.skipped)
				? ""
				: "Test was marked as a negative test and unexpectedly did not error"
			: result.errorMessage;

		return result;
	}

	private async runWithRepeatAndRetry(
		method: Method,
		options: TestRunOptions,
		caseArgs?: ReadonlyArray<unknown>,
		caseIndex?: number,
	): Promise<TestCaseResult> {
		const maxRetries = method.options.retries ?? 0;
		const repeats = math.max(1, method.options.repeats ?? 1);

		let aggregate = await this.runWithRetry(method, options, caseArgs, caseIndex, maxRetries);
		let totalTime = aggregate.elapsedTimeMs;

		for (let i = 1; i < repeats; i++) {
			const nextTry = await this.runWithRetry(method, options, caseArgs, caseIndex, maxRetries);
			totalTime += nextTry.elapsedTimeMs;
			// Surface the first failure across iterations; once failed, keep that result.
			if (aggregate.passed && !nextTry.passed) aggregate = nextTry;
		}

		aggregate.elapsedTimeMs = totalTime;
		return aggregate;
	}

	private async runWithRetry(
		method: Method,
		options: TestRunOptions,
		caseArgs: ReadonlyArray<unknown> | undefined,
		caseIndex: number | undefined,
		maxRetries: number,
	): Promise<TestCaseResult> {
		let result = await this.runOnce(method, options, caseArgs, caseIndex);
		let retries = 0;
		while (retries < maxRetries && !result.passed && !result.skipped) {
			retries++;
			result = await this.runOnce(method, options, caseArgs, caseIndex);
		}
		return result;
	}

	private async runOnce(
		method: Method,
		options: TestRunOptions,
		caseArgs?: ReadonlyArray<unknown>,
		caseIndex?: number,
	): Promise<TestCaseResult> {
		// LIFECYCLE:beforeEach
		await this.runLifecycleMethod(Lifecycle.RunBeforeEachTest);
		const result = await this.runTestMethod(method, options, caseArgs, caseIndex);
		// LIFECYCLE:afterEach
		await this.runLifecycleMethod(Lifecycle.RunAfterEachTest);
		return result;
	}

	private async runTestMethod(
		method: Method,
		options: TestRunOptions,
		caseArgs?: ReadonlyArray<unknown>,
		caseIndex?: number,
	): Promise<TestCaseResult> {
		const callback = (this.testClassConstructor as unknown as TestClass)[method.name] as Callback | undefined;
		if (!callback) {
			throw "method %s does not exist on class %s".format(method.name, this.getClassDisplayName());
		}
		const label = resolveTestLabel(method, caseArgs);
		const result: TestCaseResult = {
			method,
			label,
			passed: false,
			elapsedTimeMs: 0,
			skipped: false,
			caseIndex,
			caseArgs,
		};
		options.reporter?.onTestStart?.(label);
		const start = os.clock();
		try {
			if (method.options.disabled?.value) {
				result.skipped = true;
				result.errorMessage = method.options.disabled.message;
			} else {
				const invoke =
					caseArgs !== undefined ? () => callback(this.instance, ...caseArgs) : () => callback(this.instance);
				const timeout = method.options.timeout;
				if (timeout) {
					const [status] = Promise.try(invoke)
						.timeout(timeout / 1000)
						.awaitStatus();

					if (status === Promise.Status.Resolved) {
						result.passed = true;
					} else {
						result.errorMessage = "Test exceeded timeout of %dms".format(timeout);
					}
				} else {
					await invoke();
					result.passed = true;
				}
			}
		} catch (e) {
			result.errorMessage = tostring(e);
		} finally {
			result.elapsedTimeMs = (os.clock() - start) * 1000;
		}
		const finalResult = this.createFinalTestCaseResult(result);
		this.onTestMethodRan(finalResult, options);
		return finalResult;
	}

	private onTestMethodRan(result: TestCaseResult, { reporter }: TestRunOptions): void {
		if (result.passed) {
			// REPORTER:onTestPassed
			reporter?.onTestPassed?.(result.label);
		} else if (result.skipped) {
			// REPORTER:onTestSkipped
			reporter?.onTestSkipped?.(result.label, result.errorMessage);
		} else {
			// REPORTER:onTestFailed
			reporter?.onTestFailed?.(result.label, result.errorMessage);
		}
		// REPORTER:onTestEnd
		reporter?.onTestEnd?.(result.label, result);
	}

	private getClassDisplayName(): string {
		return this.metadata?.displayName ?? tostring(this.testClassConstructor);
	}
}
