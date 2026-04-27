import Assert from "../lib/assert";
import { Test } from "../lib/decorator";
import { TestRunner } from "../lib/runner/runner";

const silentReporter = { output() {} };

class TestRunnerApi {
	@Test
	public async fromClassesReturnsRunner() {
		class Subject {
			@Test
			public a() {}
		}

		const runner = TestRunner.fromClasses([Subject]);
		const result = await runner.run({ reporter: silentReporter });
		Assert.equal(result.numTests, 1);
	}

	@Test
	public async addClassIsChainable() {
		class A {
			@Test
			public a() {}
		}
		class B {
			@Test
			public b() {}
		}

		const result = await new TestRunner().addClass(A).addClass(B).run({ reporter: silentReporter });
		Assert.equal(result.numTests, 2);
	}

	@Test
	public async emptyRunnerProducesZeroTests() {
		const result = await new TestRunner().run({ reporter: silentReporter });
		Assert.equal(result.numTests, 0);
	}

	@Test
	public async resultsKeyedByConstructor() {
		class Subject {
			@Test
			public passing() {}
		}

		const result = await TestRunner.fromClasses([Subject]).run({ reporter: silentReporter });
		Assert.notUndefined(result.tests.get(Subject));
		Assert.equal(result.tests.get(Subject)!.numTestsPassed, 1);
	}

	@Test
	public async failuresAreCounted() {
		class Subject {
			@Test
			public failing() {
				error("boom");
			}
		}

		const result = await TestRunner.fromClasses([Subject]).run({ reporter: silentReporter });
		Assert.equal(result.numTestsFailed, 1);
		Assert.equal(result.numTestsPassed, 0);
	}

	@Test
	public async reporterHooksFire() {
		class Subject {
			@Test
			public a() {}
		}

		let started = false;
		let ended = false;
		let onTestStartCount = 0;
		let onTestEndCount = 0;

		await TestRunner.fromClasses([Subject]).run({
			reporter: {
				onRunStart() {
					started = true;
				},
				onRunEnd() {
					ended = true;
				},
				onTestStart() {
					onTestStartCount++;
				},
				onTestEnd() {
					onTestEndCount++;
				},
				output() {},
			},
		});

		Assert.true(started);
		Assert.true(ended);
		Assert.equal(onTestStartCount, 1);
		Assert.equal(onTestEndCount, 1);
	}
}

export = TestRunnerApi;
