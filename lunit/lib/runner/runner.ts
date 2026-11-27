import { getDescendantsOfType } from "../../utils/instance";

import { TestClassConstructor, TestRunOptions, Constructor, TestRunResult, BaseTestRunResult, TestPlan } from "./types";
import { getTestSummary } from "../reporter/printer";
import { TestClassRunner } from "./class";
import { DEFAULT_ORDER } from "../shared/constants";
import { Coverage, NO_COVERAGE_MESSAGE } from "../coverage";

const DEFAULT_GLOB_PATTERNS: ReadonlyArray<string> = [".+%.test$", ".+%.spec$"];

type GlobPattern = string | ReadonlyArray<string>;

function normalizePatterns(input: GlobPattern): ReadonlyArray<string> {
	return typeIs(input, "string") ? [input] : input;
}

export class TestRunner {
	private testClasses: TestClassRunner[] = [];

	public constructor(
		roots: ReadonlyArray<Instance | undefined> = [],
		globPattern: GlobPattern = DEFAULT_GLOB_PATTERNS,
	) {
		for (const root of roots) {
			if (root !== undefined) this.addRoot(root, globPattern);
		}
	}

	/**
	 * Creates a runner from an explicit list of test class constructors. Use this in
	 * non-Roblox environments (Lune, CI) where DataModel-based discovery isn't available,
	 * or any time you want explicit control over which classes run.
	 *
	 * @example
	 * ```typescript
	 * import TestAssert from "./test/assert.test";
	 * import TestDecorators from "./test/decorators.test";
	 *
	 * const runner = TestRunner.fromClasses([TestAssert, TestDecorators]);
	 * await runner.run();
	 * ```
	 */
	public static fromClasses(classes: ReadonlyArray<TestClassConstructor>): TestRunner {
		const runner = new TestRunner();
		for (const ctor of classes) runner.addClass(ctor);
		return runner;
	}

	public addRoot(root: Instance, globPattern: GlobPattern = DEFAULT_GLOB_PATTERNS): this {
		const patterns = normalizePatterns(globPattern);
		const modules = getDescendantsOfType(root, "ModuleScript");
		modules.forEach((module) => {
			if (patterns.some((p) => module.Name.match(p)[0] !== undefined)) {
				try {
					const testClass = require(module) as Constructor;
					this.tryAddClass(testClass, module.Name);
				} catch (e) {
					warn('failed to load module "%s": %s'.format(module.Name, tostring(e)));
				}
			}
		});
		return this;
	}

	/**
	 * Registers a single test class constructor. Returns the runner for chaining.
	 *
	 * @example
	 * ```typescript
	 * new TestRunner()
	 *   .addClass(TestAssert)
	 *   .addClass(TestDecorators)
	 *   .run();
	 * ```
	 */
	public addClass(ctor: TestClassConstructor): this {
		this.tryAddClass(ctor, tostring(ctor));
		return this;
	}

	private tryAddClass(ctor: Constructor | undefined, sourceName: string): void {
		if (ctor === undefined) {
			warn('test class "%s" did not return a value'.format(sourceName));
			return;
		}
		if ((ctor as unknown as Record<string, unknown>)["new"] === undefined) {
			warn('test class "%s" is not a class'.format(sourceName));
			return;
		}
		this.testClasses.push(new TestClassRunner(ctor));
	}

	/**
	 * Lists the classes and tests that `run` would run with the same options,
	 * without running anything: display names, tags, `@Each` rows and skip
	 * reasons. Editors and plugins use it to show a test tree.
	 */
	public describe(options: TestRunOptions = {}): TestPlan {
		const plan: TestPlan = { classes: [], numTests: 0 };
		for (const testClass of this.getClassesToRun()) {
			const described = testClass.describe(options);
			if (this.isFiltered(options) && described.tests.size() === 0) continue;
			plan.classes.push(described);
			for (const test of described.tests) plan.numTests += math.max(1, test.cases.size());
		}
		return plan;
	}

	private getClassesToRun(): TestClassRunner[] {
		const focused = this.testClasses.filter((c) => c.getMetadata().only);
		return (focused.size() > 0 ? focused : this.testClasses).sort(
			(a, b) => (a.getMetadata().order ?? DEFAULT_ORDER) < (b.getMetadata().order ?? DEFAULT_ORDER),
		);
	}

	private isFiltered(options: TestRunOptions): boolean {
		return (
			options.filter !== undefined ||
			options.tests !== undefined ||
			(options.tags?.size() ?? 0) > 0 ||
			(options.excludeTags?.size() ?? 0) > 0
		);
	}

	public async run(options: TestRunOptions = {}): Promise<TestRunResult> {
		const { reporter = {} } = options;
		const getReport = reporter.getReport ?? getTestSummary;

		const results: TestRunResult = {
			elapsedTimeMs: 0,
			numTests: 0,
			numTestsPassed: 0,
			numTestsSkipped: 0,
			numTestsFailed: 0,
			tests: new Map(),
			tags: options.tags,
		};
		// REPORTER:onRunStart
		reporter.onRunStart?.();
		const isFiltered = this.isFiltered(options);
		for (const testClass of this.getClassesToRun()) {
			const classResults = await testClass.runTests(options);
			// A filter can leave a class with no tests; keep it out of the report.
			if (isFiltered && classResults.numTests === 0) continue;
			this.addResults(results, classResults);
			results.tests.set(testClass.getConstructor(), classResults);
			if (options.bail && results.numTestsFailed > 0) break;
		}
		// REPORTER:onRunEnd
		reporter.onRunEnd?.();
		const output = (text: string) => (reporter.output !== undefined ? reporter.output(text) : print(text));
		output(getReport(results));
		if (options.coverage) {
			results.coverage = Coverage.collect();
			output(results.coverage !== undefined ? Coverage.formatSummary(results.coverage) : NO_COVERAGE_MESSAGE);
		}
		return results;
	}

	private addResults(destination: BaseTestRunResult, source: BaseTestRunResult): void {
		destination.elapsedTimeMs += source.elapsedTimeMs;
		destination.numTests += source.numTests;
		destination.numTestsPassed += source.numTestsPassed;
		destination.numTestsSkipped += source.numTestsSkipped;
		destination.numTestsFailed += source.numTestsFailed;
	}
}
