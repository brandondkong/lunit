import Assert from "../lib/assert";
import { BeforeAll, BeforeEach, Disabled, DisplayName, Negated, Tag, Test, Timeout } from "../lib/decorator";
import { formatTestResult } from "../lib/reporter/printer";
import { Runtime } from "../lib/runtime";
import { getRuntimeSkipReason } from "../lib/runner/class";
import { TestRunner } from "../lib/runner/runner";
import DiscoveredFixture from "./fixtures/discovered.fixture";

const silentReporter = { output: () => {} };

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
				output: () => {},
			},
		});

		Assert.true(started);
		Assert.true(ended);
		Assert.equal(onTestStartCount, 1);
		Assert.equal(onTestEndCount, 1);
	}

	@Test
	public async excludeTagsLeavesOutTaggedTests() {
		@Tag("Slow")
		class SlowClass {
			@Test
			public a() {}
		}
		class Mixed {
			@Tag("Slow")
			@Test
			public slow() {}

			@Test
			public fast() {}
		}

		const result = await TestRunner.fromClasses([SlowClass, Mixed]).run({
			reporter: silentReporter,
			excludeTags: ["Slow"],
		});
		Assert.equal(result.numTests, 1);
		Assert.equal(result.tests.get(Mixed)!.tests[0].method.name, "fast");
	}

	@Test
	public async filterMatchesClassAndMethodName() {
		class FilterSubject {
			@Test
			public alpha() {}

			@Test
			public beta() {}
		}

		const byMethod = await TestRunner.fromClasses([FilterSubject]).run({
			reporter: silentReporter,
			filter: "FilterSubject.beta",
		});
		Assert.equal(byMethod.numTests, 1);

		const byClass = await TestRunner.fromClasses([FilterSubject]).run({
			reporter: silentReporter,
			filter: "FilterSubject",
		});
		Assert.equal(byClass.numTests, 2);

		const noMatch = await TestRunner.fromClasses([FilterSubject]).run({
			reporter: silentReporter,
			filter: "gamma",
		});
		Assert.equal(noMatch.numTests, 0);
		// Classes left with no tests are not reported.
		Assert.undefined(noMatch.tests.get(FilterSubject));
	}

	@Test
	public async filterIsPlainText() {
		class Subject {
			@Test
			public a() {}
		}

		// "." and "%" would be pattern characters in string.find without plain mode.
		const result = await TestRunner.fromClasses([Subject]).run({ reporter: silentReporter, filter: "%." });
		Assert.equal(result.numTests, 0);
	}

	@Test
	public async filterMatchesDisplayName() {
		class Subject {
			@DisplayName("adds two numbers")
			@Test
			public a() {}

			@Test
			public b() {}
		}

		const result = await TestRunner.fromClasses([Subject]).run({ reporter: silentReporter, filter: "two numbers" });
		Assert.equal(result.numTests, 1);
	}

	@Test
	public async bailStopsAfterFirstFailure() {
		let ranAfterFailure = false;
		class First {
			@Test
			public failing() {
				error("boom");
			}

			@Test
			public later() {
				ranAfterFailure = true;
			}
		}
		class Second {
			@Test
			public other() {
				ranAfterFailure = true;
			}
		}

		const result = await TestRunner.fromClasses([First, Second]).run({ reporter: silentReporter, bail: true });
		Assert.equal(result.numTestsFailed, 1);
		Assert.equal(result.numTests, 1);
		Assert.false(ranAfterFailure);
		Assert.undefined(result.tests.get(Second));
	}

	@Test
	public async withoutBailAllTestsRun() {
		class Subject {
			@Test
			public failing() {
				error("boom");
			}

			@Test
			public passing() {}
		}

		const result = await TestRunner.fromClasses([Subject]).run({ reporter: silentReporter });
		Assert.equal(result.numTests, 2);
	}

	@Test
	public async runtimeTagsSkipTestsForTheOtherRuntime() {
		let hookRuns = 0;
		class Subject {
			@BeforeEach
			public hook() {
				hookRuns++;
			}

			@Tag("Lune")
			@Test
			public luneOnly() {}

			@Tag("Roblox")
			@Test
			public robloxOnly() {}

			@Tag("Studio")
			@Test
			public studioOnly() {}

			@Tag("Lune", "Roblox")
			@Test
			public both() {}
		}

		const result = await TestRunner.fromClasses([Subject]).run({ reporter: silentReporter });
		const byName = new Map<string, { skipped: boolean; errorMessage?: string }>();
		for (const test of result.tests.get(Subject)!.tests) byName.set(test.method.name, test);

		const lune = Runtime.isLune();
		Assert.equal(byName.get("luneOnly")!.skipped, !lune);
		Assert.equal(byName.get("robloxOnly")!.skipped, lune);
		Assert.equal(byName.get("studioOnly")!.skipped, lune);
		Assert.false(byName.get("both")!.skipped);
		Assert.equal(byName.get("robloxOnly")!.errorMessage, lune ? "Roblox only" : undefined);
		// Hooks run only for the two tests that ran.
		Assert.equal(hookRuns, 2);
	}

	@Test
	public async classRuntimeTagSkipsClassWithoutHooks() {
		let beforeAllRan = false;
		@Tag(Runtime.isLune() ? "Roblox" : "Lune")
		class OtherRuntime {
			@BeforeAll
			public setup() {
				beforeAllRan = true;
			}

			@Test
			public a() {}
		}

		const result = await TestRunner.fromClasses([OtherRuntime]).run({ reporter: silentReporter });
		Assert.equal(result.numTestsSkipped, 1);
		Assert.false(beforeAllRan);
	}

	@Test
	public async negatedTestMessages() {
		class Subject {
			@Negated
			@Test
			public throws() {
				error("expected");
			}

			@Negated
			@Test
			public doesNotThrow() {}
		}

		const result = await TestRunner.fromClasses([Subject]).run({ reporter: silentReporter });
		const tests = result.tests.get(Subject)!.tests;
		const throws = tests.find((t) => t.method.name === "throws")!;
		const doesNotThrow = tests.find((t) => t.method.name === "doesNotThrow")!;
		Assert.true(throws.passed);
		Assert.undefined(throws.errorMessage);
		Assert.false(doesNotThrow.passed);
		Assert.equal(doesNotThrow.errorMessage, "Test was marked as a negative test and unexpectedly did not error");
	}

	@Test
	public async reportShowsSkipReasonFromResult() {
		@Disabled("class is off")
		class DisabledClass {
			@Negated
			@Test
			public a() {}
		}

		const result = await TestRunner.fromClasses([DisabledClass]).run({ reporter: silentReporter });
		const test = result.tests.get(DisabledClass)!.tests[0];
		Assert.equal(test.errorMessage, "class is off");
		const line = formatTestResult(test).toString();
		Assert.notUndefined(line.find("SKIPPED (class is off)", 1, true)[0]);
	}

	@Test
	public async addRootFindsMatchingModules() {
		// The import above loads the fixture, so its ModuleScript exists under Lune too.
		Assert.notEqual(DiscoveredFixture, undefined);
		const fixtures = script.Parent!.FindFirstChild("fixtures")!;
		const result = await new TestRunner([fixtures], ".+%.fixture$").run({ reporter: silentReporter });
		Assert.equal(result.numTests, 1);
		Assert.equal(result.numTestsPassed, 1);
	}

	@Test
	public async addRootSkipsModulesThatDoNotMatch() {
		const fixtures = script.Parent!.FindFirstChild("fixtures")!;
		const result = await new TestRunner([fixtures, undefined]).run({ reporter: silentReporter });
		Assert.equal(result.numTests, 0);
	}

	@Test
	public async addRootSurvivesModulesThatFailToLoad() {
		const root = new Instance("Folder");
		const broken = new Instance("ModuleScript");
		broken.Name = "broken.test";
		broken.Parent = root;
		const result = await new TestRunner().addRoot(root).run({ reporter: silentReporter });
		Assert.equal(result.numTests, 0);
		root.Destroy();
	}

	@Test
	public async addClassIgnoresValuesThatAreNotClasses() {
		const runner = new TestRunner()
			.addClass(undefined as unknown as new () => object)
			.addClass({} as unknown as new () => object);
		const result = await runner.run({ reporter: silentReporter });
		Assert.equal(result.numTests, 0);
	}

	@Test
	public runRejectsWhenTestMethodIsMissing() {
		class Subject {
			@Test
			public gone() {}
		}
		(Subject as unknown as { gone?: unknown }).gone = undefined;
		Assert.rejects(TestRunner.fromClasses([Subject]).run({ reporter: silentReporter }));
	}

	@Test
	public async failingHookDoesNotStopTheTest() {
		class Subject {
			@BeforeEach
			public broken() {
				error("hook failed");
			}

			@Test
			public a() {}
		}
		const result = await TestRunner.fromClasses([Subject]).run({ reporter: silentReporter });
		Assert.equal(result.numTestsPassed, 1);
	}

	@Test
	public async timeoutTestThatFinishesInTimePasses() {
		class Subject {
			@Timeout(1000)
			@Test
			public quick() {}
		}
		const result = await TestRunner.fromClasses([Subject]).run({ reporter: silentReporter });
		Assert.equal(result.numTestsPassed, 1);
	}

	@Test
	public runtimeSkipReasonForEachRuntime() {
		Assert.equal(getRuntimeSkipReason(["smoke"], true), undefined);
		Assert.equal(getRuntimeSkipReason(["Lune"], true), undefined);
		Assert.equal(getRuntimeSkipReason(["Roblox"], true), "Roblox only");
		Assert.equal(getRuntimeSkipReason(["Studio"], false), undefined);
		Assert.equal(getRuntimeSkipReason(["Lune"], false), "Lune only");
		Assert.equal(getRuntimeSkipReason(["Lune", "Roblox"], false), undefined);
	}
}

export = TestRunnerApi;
