import Assert from "../lib/assert";
import { Coverage, NO_COVERAGE_MESSAGE } from "../lib/coverage";
import { AfterEach, BeforeEach, Test } from "../lib/decorator";
import { TestRunner } from "../lib/runner/runner";

type Store = { [file: string]: { [line: number]: number } };
const globals = _G as unknown as { __lunitCoverage?: Store };

class Subject {
	@Test
	public passes() {}
}

class TestCoverage {
	private saved?: Store;

	@BeforeEach
	public useFakeData() {
		this.saved = globals.__lunitCoverage;
		globals.__lunitCoverage = {
			"src/b.ts": { 1: 2, 2: 0, 3: 0, 5: 1, 8: 0 },
			"src/a.ts": { 4: 1 },
		};
	}

	@AfterEach
	public restore() {
		globals.__lunitCoverage = this.saved;
	}

	@Test
	public collectCountsLinesAndSortsFiles() {
		const report = Coverage.collect();
		Assert.notEqual(report, undefined);
		Assert.equal(report!.files[0].file, "src/a.ts");
		Assert.equal(report!.files[1].file, "src/b.ts");
		Assert.equal(report!.files[1].linesHit, 2);
		Assert.equal(report!.files[1].linesFound, 5);
		Assert.equal(report!.linesHit, 3);
		Assert.equal(report!.linesFound, 6);
	}

	@Test
	public collectReturnsUndefinedWithoutData() {
		globals.__lunitCoverage = undefined;
		Assert.equal(Coverage.collect(), undefined);
		globals.__lunitCoverage = {};
		Assert.equal(Coverage.collect(), undefined);
	}

	@Test
	public summaryShowsPercentAndMissedRanges() {
		const summary = Coverage.formatSummary(Coverage.collect()!);
		Assert.notEqual(summary.find("100.0%", 1, true)[0], undefined);
		Assert.notEqual(summary.find("40.0%", 1, true)[0], undefined);
		Assert.notEqual(summary.find("missed: 2-3, 8", 1, true)[0], undefined);
		Assert.notEqual(summary.find("Total 50.0% (3/6 lines)", 1, true)[0], undefined);
	}

	@Test
	public lcovHasOneRecordPerFile() {
		const lcov = Coverage.toLcov(Coverage.collect()!);
		Assert.equal(
			lcov,
			[
				"TN:",
				"SF:src/a.ts",
				"DA:4,1",
				"LH:1",
				"LF:1",
				"end_of_record",
				"TN:",
				"SF:src/b.ts",
				"DA:1,2",
				"DA:2,0",
				"DA:3,0",
				"DA:5,1",
				"DA:8,0",
				"LH:2",
				"LF:5",
				"end_of_record",
				"",
			].join("\n"),
		);
	}

	@Test
	public resetSetsCountsToZero() {
		Coverage.reset();
		Assert.equal(Coverage.collect()!.linesHit, 0);
	}

	@Test
	public async runWithCoverageAddsReportAndPrintsSummary() {
		const output: string[] = [];
		const result = await TestRunner.fromClasses([Subject]).run({
			coverage: true,
			reporter: { output: (text) => output.push(text) },
		});
		Assert.equal(result.coverage?.linesFound, 6);
		Assert.equal(output.size(), 2);
		Assert.notEqual(output[1].find("Coverage (lines)", 1, true)[0], undefined);
	}

	@Test
	public async runWithCoverageExplainsMissingData() {
		globals.__lunitCoverage = undefined;
		const output: string[] = [];
		const result = await TestRunner.fromClasses([Subject]).run({
			coverage: true,
			reporter: { output: (text) => output.push(text) },
		});
		Assert.equal(result.coverage, undefined);
		Assert.equal(output[1], NO_COVERAGE_MESSAGE);
	}

	@Test
	public async runWithoutCoverageLeavesItOut() {
		const output: string[] = [];
		const result = await TestRunner.fromClasses([Subject]).run({
			reporter: { output: (text) => output.push(text) },
		});
		Assert.equal(result.coverage, undefined);
		Assert.equal(output.size(), 1);
	}
}

export = TestCoverage;
