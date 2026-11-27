import { Assert, Test } from "@rbxts/lunit";
import { coverageRows, formatPercent, missedRanges, totalPercent } from "./coverage";

const report = {
	files: [
		{ file: "src/a.ts", lines: new Map([[1, 1]]), linesHit: 1, linesFound: 1 },
		{
			file: "src/b.ts",
			lines: new Map([
				[1, 2],
				[2, 0],
				[3, 0],
				[5, 1],
				[8, 0],
			]),
			linesHit: 2,
			linesFound: 5,
		},
	],
	linesHit: 3,
	linesFound: 6,
};

class TestCoverageRows {
	@Test
	public missedLinesBecomeRanges() {
		Assert.equal(
			missedRanges(
				new Map([
					[1, 2],
					[2, 0],
					[3, 0],
					[5, 1],
					[8, 0],
				]),
			),
			"2-3, 8",
		);
		Assert.equal(missedRanges(new Map([[1, 1]])), "");
	}

	@Test
	public rowsPutTheLowestCoverageFirst() {
		const rows = coverageRows(report);
		Assert.deepEqual(
			rows.map((r) => r.file),
			["src/b.ts", "src/a.ts"],
		);
		Assert.equal(formatPercent(rows[0].percent), "40.0%");
		Assert.equal(rows[0].missed, "2-3, 8");
		Assert.equal(formatPercent(totalPercent(report)), "50.0%");
	}
}

export = TestCoverageRows;
