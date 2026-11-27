/**
 * The parts of @rbxts/lunit the plugin uses. The plugin runs the copy of Lunit
 * that the place already has, so the plugin and the tests always agree on the
 * version. These types describe that copy's API structurally; `describe` and
 * the `tests` option need Lunit 4.4 or later.
 */

export interface PlanTest {
	name: string;
	displayName: string;
	tags: string[];
	cases: string[];
	skipReason?: string;
}

export interface PlanClass {
	testClass: unknown;
	name: string;
	displayName: string;
	tags: string[];
	skipReason?: string;
	tests: PlanTest[];
}

export interface TestPlan {
	classes: PlanClass[];
	numTests: number;
}

export interface CaseResult {
	method: { name: string };
	label: string;
	passed: boolean;
	skipped: boolean;
	errorMessage?: string;
	elapsedTimeMs: number;
	caseIndex?: number;
}

export interface FileCoverage {
	file: string;
	lines: Map<number, number>;
	linesHit: number;
	linesFound: number;
}

export interface CoverageReport {
	files: FileCoverage[];
	linesHit: number;
	linesFound: number;
}

export interface RunResult {
	numTests: number;
	numTestsPassed: number;
	numTestsFailed: number;
	numTestsSkipped: number;
	elapsedTimeMs: number;
	tests: Map<unknown, { tests: CaseResult[] }>;
	coverage?: CoverageReport;
}

export interface RunOptions {
	tests?: string[];
	coverage?: boolean;
	reporter?: { output?: (text: string) => void };
}

export interface Runner {
	describe?: (this: Runner, options?: RunOptions) => TestPlan;
	run(this: Runner, options?: RunOptions): { expect(): RunResult };
}

export interface LunitModule {
	TestRunner: { fromClasses(this: unknown, classes: unknown[]): Runner };
}
