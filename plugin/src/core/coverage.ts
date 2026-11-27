import type { CoverageReport } from "./lunit";

export interface CoverageRow {
	file: string;
	percent: number;
	hit: number;
	found: number;
	/** Missed lines as ranges, e.g. `12, 20-24`. */
	missed: string;
}

/**
 * Missed lines as ranges. Lines next to each other among the counted lines
 * join one range, even if the source has lines without code between them.
 */
export function missedRanges(lines: Map<number, number>): string {
	const sorted: number[] = [];
	for (const [line] of lines) sorted.push(line);
	sorted.sort((a, b) => a < b);
	const ranges: string[] = [];
	let start: number | undefined;
	let last: number | undefined;
	const close = () => {
		if (start === undefined || last === undefined) return;
		ranges.push(start === last ? tostring(start) : `${start}-${last}`);
		start = undefined;
		last = undefined;
	};
	for (const line of sorted) {
		if ((lines.get(line) ?? 0) > 0) {
			close();
		} else {
			if (start === undefined) start = line;
			last = line;
		}
	}
	close();
	return ranges.join(", ");
}

function percent(hit: number, found: number): number {
	return found > 0 ? (hit / found) * 100 : 100;
}

/** One row per file, lowest coverage first, so the gaps are at the top. */
export function coverageRows(report: CoverageReport): CoverageRow[] {
	const rows = report.files.map(
		(file): CoverageRow => ({
			file: file.file,
			percent: percent(file.linesHit, file.linesFound),
			hit: file.linesHit,
			found: file.linesFound,
			missed: missedRanges(file.lines),
		}),
	);
	rows.sort((a, b) => (a.percent === b.percent ? a.file < b.file : a.percent < b.percent));
	return rows;
}

export function totalPercent(report: CoverageReport): number {
	return percent(report.linesHit, report.linesFound);
}

export function formatPercent(value: number): string {
	return string.format("%.1f%%", value);
}
