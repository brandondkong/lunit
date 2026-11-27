/**
 * Line coverage collected by the Lunit transformer (`@rbxts/lunit/transformer`).
 *
 * Each instrumented module puts a table of line counts at
 * `_G.__lunitCoverage[file]`, where `file` is the TypeScript path relative to
 * the project. Without the transformer, there is no data.
 */

type CoverageStore = { [file: string]: { [line: number]: number } };

export interface FileCoverage {
	/** TypeScript source path, relative to the project folder. */
	file: string;
	/** Execution count for each line that starts a statement. */
	lines: Map<number, number>;
	linesHit: number;
	linesFound: number;
}

export interface CoverageReport {
	/** Sorted by path. */
	files: FileCoverage[];
	linesHit: number;
	linesFound: number;
}

export const NO_COVERAGE_MESSAGE =
	"No coverage data. Build with the Lunit transformer first: rbxtsc -p tsconfig.coverage.json";

function getStore(): CoverageStore | undefined {
	return (_G as unknown as { __lunitCoverage?: CoverageStore }).__lunitCoverage;
}

function sortedLines(lines: Map<number, number>): number[] {
	const sorted: number[] = [];
	for (const [line] of lines) sorted.push(line);
	sorted.sort((a, b) => a < b);
	return sorted;
}

function percent(hit: number, found: number): string {
	return string.format("%.1f%%", found > 0 ? (hit / found) * 100 : 100);
}

/**
 * Missed lines as ranges, e.g. `12, 20-24`. Lines next to each other in the
 * list of counted lines join one range, even if the source has lines between
 * them that run no code.
 */
function missedRanges(file: FileCoverage): string {
	const ranges: string[] = [];
	let start: number | undefined;
	let last: number | undefined;
	const close = () => {
		if (start === undefined || last === undefined) return;
		ranges.push(start === last ? tostring(start) : `${start}-${last}`);
		start = undefined;
		last = undefined;
	};
	for (const line of sortedLines(file.lines)) {
		if ((file.lines.get(line) ?? 0) > 0) {
			close();
		} else {
			if (start === undefined) start = line;
			last = line;
		}
	}
	close();
	return ranges.join(", ");
}

/** Reads the counts that instrumented modules have recorded so far. */
function collect(): CoverageReport | undefined {
	const store = getStore();
	if (store === undefined) return undefined;
	const files: FileCoverage[] = [];
	let linesHit = 0;
	let linesFound = 0;
	for (const [file, counts] of pairs(store)) {
		const lines = new Map<number, number>();
		let hit = 0;
		let found = 0;
		for (const [line, count] of pairs(counts)) {
			lines.set(line, count);
			found += 1;
			if (count > 0) hit += 1;
		}
		files.push({ file: tostring(file), lines, linesHit: hit, linesFound: found });
		linesHit += hit;
		linesFound += found;
	}
	if (files.size() === 0) return undefined;
	files.sort((a, b) => a.file < b.file);
	return { files, linesHit, linesFound };
}

/** Sets every recorded count back to zero. */
function reset(): void {
	const store = getStore();
	if (store === undefined) return;
	for (const [, counts] of pairs(store)) {
		for (const [line] of pairs(counts)) counts[line] = 0;
	}
}

/** A table with one row per file and a total. */
function formatSummary(report: CoverageReport): string {
	const rows = ["Coverage (lines)"];
	for (const file of report.files) {
		const counts = `${file.linesHit}/${file.linesFound}`;
		let row = string.format("  %7s  %9s  %s", percent(file.linesHit, file.linesFound), counts, file.file);
		const missed = missedRanges(file);
		if (missed !== "") row += `  missed: ${missed}`;
		rows.push(row);
	}
	rows.push(
		string.format(
			"  Total %s (%d/%d lines)",
			percent(report.linesHit, report.linesFound),
			report.linesHit,
			report.linesFound,
		),
	);
	return rows.join("\n");
}

/** The report in lcov format, for Codecov, Coverage Gutters and similar tools. */
function toLcov(report: CoverageReport): string {
	const out: string[] = [];
	for (const file of report.files) {
		out.push("TN:", `SF:${file.file}`);
		for (const line of sortedLines(file.lines)) out.push(`DA:${line},${file.lines.get(line)}`);
		out.push(`LH:${file.linesHit}`, `LF:${file.linesFound}`, "end_of_record");
	}
	return out.join("\n") + "\n";
}

export const Coverage = {
	collect,
	reset,
	formatSummary,
	toLcov,
};

export default Coverage;
