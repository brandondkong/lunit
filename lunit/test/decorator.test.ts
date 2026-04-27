import Assert from "../lib/assert";
import {
	After,
	AfterAll,
	AfterEach,
	Before,
	BeforeAll,
	BeforeEach,
	Disabled,
	DisplayName,
	Each,
	Negated,
	Only,
	Order,
	Repeat,
	Retry,
	Skip,
	Tag,
	Test,
	Timeout,
} from "../lib/decorator";
import { TestRunner } from "../lib/runner/runner";
import { TestClassConstructor, TestRunOptions, TestRunResult } from "../lib/runner/types";

const silentReporter = { output() {} };

async function runIsolated(
	classes: ReadonlyArray<TestClassConstructor>,
	options: Omit<TestRunOptions, "reporter"> = {},
): Promise<TestRunResult> {
	return TestRunner.fromClasses(classes).run({ ...options, reporter: silentReporter });
}

class TestDecorators {
	@Test
	public async testRegistration() {
		class Subject {
			@Test
			public a() {}
			@Test
			public b() {}
		}

		const result = await runIsolated([Subject]);
		Assert.equal(result.numTests, 2);
		Assert.equal(result.numTestsPassed, 2);
	}

	@Test
	public async displayNameAppearsInLabel() {
		class Subject {
			@DisplayName("renamed test")
			@Test
			public original() {}
		}

		const result = await runIsolated([Subject]);
		const cases = result.tests.get(Subject)!.tests;
		Assert.equal(cases[0].label, "renamed test");
	}

	@Test
	public async disabledMarksTestSkipped() {
		class Subject {
			@Disabled("temporarily off")
			@Test
			public passing() {}
		}

		const result = await runIsolated([Subject]);
		Assert.equal(result.numTestsSkipped, 1);
		Assert.equal(result.numTestsPassed, 0);
		Assert.equal(result.tests.get(Subject)!.tests[0].errorMessage, "temporarily off");
	}

	@Test
	public async skipRespectsCondition() {
		class Subject {
			@Skip(true, "off")
			@Test
			public skipped() {}
			@Skip(false)
			@Test
			public ran() {}
		}

		const result = await runIsolated([Subject]);
		Assert.equal(result.numTestsSkipped, 1);
		Assert.equal(result.numTestsPassed, 1);
	}

	@Test
	public async negatedFlipsResult() {
		class Subject {
			@Negated
			@Test
			public throwsAsExpected() {
				error("boom");
			}
			@Negated
			@Test
			public unexpectedlyPasses() {}
		}

		const result = await runIsolated([Subject]);
		Assert.equal(result.numTestsPassed, 1);
		Assert.equal(result.numTestsFailed, 1);
	}

	@Test
	public async orderRunsLowestFirst() {
		const seen: string[] = [];
		class Subject {
			@Order(2)
			@Test
			public second() {
				seen.push("second");
			}
			@Order(1)
			@Test
			public first() {
				seen.push("first");
			}
		}

		await runIsolated([Subject]);
		Assert.deepEqual(seen, ["first", "second"]);
	}

	@Test
	public async tagFiltersTests() {
		class Subject {
			@Tag("smoke")
			@Test
			public smoke() {}
			@Tag("slow")
			@Test
			public slow() {}
		}

		const result = await runIsolated([Subject], { tags: ["smoke"] });
		Assert.equal(result.numTests, 1);
		Assert.equal(result.tests.get(Subject)!.tests[0].method.name, "smoke");
	}

	@Test
	public async onlyNarrowsToFocusedTests() {
		class Subject {
			@Only
			@Test
			public focused() {}
			@Test
			public ignored() {}
		}

		const result = await runIsolated([Subject]);
		Assert.equal(result.numTests, 1);
		Assert.equal(result.tests.get(Subject)!.tests[0].method.name, "focused");
	}

	@Test
	public async eachExpandsRows() {
		const seen: number[][] = [];
		class Subject {
			@Each([
				[1, 2, 3],
				[10, 20, 30],
			])
			@Test
			public addition(a: number, b: number, sum: number) {
				seen.push([a, b, sum]);
				Assert.equal(a + b, sum);
			}
		}

		const result = await runIsolated([Subject]);
		Assert.equal(result.numTests, 2);
		Assert.equal(result.numTestsPassed, 2);
		Assert.deepEqual(seen, [
			[1, 2, 3],
			[10, 20, 30],
		]);
		const cases = result.tests.get(Subject)!.tests;
		Assert.equal(cases[0].label, "addition (1, 2, 3)");
		Assert.equal(cases[1].label, "addition (10, 20, 30)");
	}

	@Test
	public async retryEventuallyPasses() {
		let attempts = 0;
		class Subject {
			@Retry(3)
			@Test
			public flaky() {
				attempts++;
				if (attempts < 3) error("not yet");
			}
		}

		const result = await runIsolated([Subject]);
		Assert.equal(attempts, 3);
		Assert.equal(result.numTestsPassed, 1);
	}

	@Test
	public async retryGivesUpAfterMax() {
		let attempts = 0;
		class Subject {
			@Retry(2)
			@Test
			public alwaysFails() {
				attempts++;
				error("nope");
			}
		}

		const result = await runIsolated([Subject]);
		Assert.equal(attempts, 3);
		Assert.equal(result.numTestsFailed, 1);
	}

	@Test
	public async repeatRunsNTimes() {
		let runs = 0;
		class Subject {
			@Repeat(5)
			@Test
			public race() {
				runs++;
			}
		}

		await runIsolated([Subject]);
		Assert.equal(runs, 5);
	}

	@Test
	public async repeatFailsIfAnyIterationFails() {
		let runs = 0;
		class Subject {
			@Repeat(3)
			@Test
			public flake() {
				runs++;
				if (runs === 2) error("flaked");
			}
		}

		const result = await runIsolated([Subject]);
		Assert.equal(result.numTestsFailed, 1);
	}

	@Test
	public async beforeAfterEachWrapEveryTest() {
		const events: string[] = [];
		class Subject {
			@BeforeEach
			public setup() {
				events.push("before");
			}
			@AfterEach
			public teardown() {
				events.push("after");
			}
			@Test
			public a() {
				events.push("a");
			}
			@Test
			public b() {
				events.push("b");
			}
		}

		await runIsolated([Subject]);
		Assert.deepEqual(events, ["before", "a", "after", "before", "b", "after"]);
	}

	@Test
	public async beforeAndBeforeEachAreAliases() {
		const events: string[] = [];
		class Subject {
			@Before
			public a() {
				events.push("a");
			}
			@BeforeEach
			public b() {
				events.push("b");
			}
			@Test
			public test() {}
		}

		await runIsolated([Subject]);
		Assert.equal(events.size(), 2);
		Assert.contains(events, "a");
		Assert.contains(events, "b");
	}

	@Test
	public async beforeAfterAllRunOncePerClass() {
		const events: string[] = [];
		class Subject {
			@BeforeAll
			public setup() {
				events.push("before-all");
			}
			@AfterAll
			public teardown() {
				events.push("after-all");
			}
			@Test
			public a() {
				events.push("a");
			}
			@Test
			public b() {
				events.push("b");
			}
		}

		await runIsolated([Subject]);
		Assert.deepEqual(events, ["before-all", "a", "b", "after-all"]);
	}

	@Test
	public async afterAliasesAfterEach() {
		const events: string[] = [];
		class Subject {
			@After
			public cleanup() {
				events.push("after");
			}
			@Test
			public a() {}
			@Test
			public b() {}
		}

		await runIsolated([Subject]);
		Assert.equal(events.size(), 2);
	}

	@Test
	public async timeoutFailsLongTest() {
		class Subject {
			@Timeout(10)
			@Test
			public async slow() {
				await Promise.delay(0.1);
			}
		}

		const result = await runIsolated([Subject]);
		Assert.equal(result.numTestsFailed, 1);
		Assert.match(result.tests.get(Subject)!.tests[0].errorMessage ?? "", "timeout");
	}
}

export = TestDecorators;
