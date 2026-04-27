import { getDescendantsOfType } from "../../utils/instance";

import { TestClassConstructor, TestRunOptions, Constructor, TestRunResult, BaseTestRunResult } from "./types";
import { getTestSummary } from "../reporter/printer";
import { TestClassRunner } from "./class";

const DEFAULT_GLOB_PATTERN = ".+%.test$";

export class TestRunner {
	private testClasses: TestClassRunner[] = [];

	public constructor(roots: (Instance | undefined)[], globPattern: string = DEFAULT_GLOB_PATTERN) {
		roots.filterUndefined().forEach((root) => {
			this.addRoot(root, globPattern);
		});
	}

	public addRoot(root: Instance, globPattern: string = DEFAULT_GLOB_PATTERN): void {
		const modules = getDescendantsOfType(root, "ModuleScript");
		modules.forEach((module) => {
			if (module.Name.match(globPattern) !== undefined) {
				try {
					const testClass = require(module) as Constructor;
					this.addClass(testClass, module);
				} catch (e) {
					warn('failed to load module "%s": %s'.format(module.Name, tostring(e)));
				}
			}
		});
	}

	private addClass(ctor: Constructor, module: Instance): void {
		if (ctor === undefined) {
			warn('module "%s" did not return a value'.format(module.Name));
			return;
		}
		if ((ctor as unknown as Record<string, unknown>)["new"] === undefined) {
			warn('module "%s" did not return a class'.format(module.Name));
			return;
		}
		this.testClasses.push(new TestClassRunner(ctor as TestClassConstructor));
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
		const focused = this.testClasses.filter((c) => c.getMetadata().only);
		const classesToRun = focused.size() > 0 ? focused : this.testClasses;
		for (const testClass of classesToRun) {
			const classResults = await testClass.runTests(options);
			this.addResults(results, classResults);
			results.tests.set(testClass.getConstructor(), classResults);
		}
		// REPORTER:onRunEnd
		reporter.onRunEnd?.();
		(reporter.output ?? print)(getReport(results));
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
