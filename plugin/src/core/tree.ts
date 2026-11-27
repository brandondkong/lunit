import type { CaseResult, PlanClass } from "./lunit";

export type Status = "pending" | "passed" | "failed" | "skipped";

export interface TestRow {
	id: string;
	/** The method name; the same for every `@Each` row of the method. */
	method: string;
	caseIndex?: number;
	label: string;
	tags: string[];
	status: Status;
	/** The failure or skip reason from the last run, or the planned skip reason. */
	message?: string;
	elapsedMs?: number;
}

export interface ClassRow {
	id: string;
	/** The class name, as Lunit's `tests` option expects it. */
	name: string;
	label: string;
	tags: string[];
	/** Full name of the ModuleScript the class came from. */
	modulePath: string;
	tests: TestRow[];
	expanded: boolean;
}

export interface LoadFailure {
	modulePath: string;
	message: string;
}

export interface TestTree {
	classes: ClassRow[];
	loadFailures: LoadFailure[];
}

export interface DiscoveredClass {
	modulePath: string;
	plan: PlanClass;
}

/** One row per test, or per `@Each` row, in the order Lunit will run them. */
export function buildTree(discovered: DiscoveredClass[], loadFailures: LoadFailure[] = []): TestTree {
	const classes = discovered.map(({ modulePath, plan }): ClassRow => {
		const id = `${modulePath}::${plan.name}`;
		const tests: TestRow[] = [];
		for (const test of plan.tests) {
			const message = test.skipReason ?? plan.skipReason;
			if (test.cases.size() === 0) {
				tests.push({
					id: `${id}::${test.name}`,
					method: test.name,
					label: test.displayName,
					tags: test.tags,
					status: "pending",
					message,
				});
			} else {
				test.cases.forEach((label, caseIndex) =>
					tests.push({
						id: `${id}::${test.name}#${caseIndex}`,
						method: test.name,
						caseIndex,
						label,
						tags: test.tags,
						status: "pending",
						message,
					}),
				);
			}
		}
		return { id, name: plan.name, label: plan.displayName, tags: plan.tags, modulePath, tests, expanded: true };
	});
	return { classes, loadFailures };
}

/** Carries statuses and the expanded state over from an older tree, for rows that still exist. */
export function keepState(fresh: TestTree, previous: TestTree | undefined): TestTree {
	if (previous === undefined) return fresh;
	const oldClasses = new Map(previous.classes.map((c) => [c.id, c]));
	for (const cls of fresh.classes) {
		const old = oldClasses.get(cls.id);
		if (old === undefined) continue;
		cls.expanded = old.expanded;
		const oldTests = new Map(old.tests.map((t) => [t.id, t]));
		for (const test of cls.tests) {
			const oldTest = oldTests.get(test.id);
			if (oldTest === undefined || oldTest.status === "pending") continue;
			test.status = oldTest.status;
			test.message = oldTest.message;
			test.elapsedMs = oldTest.elapsedMs;
		}
	}
	return fresh;
}

/**
 * Puts the classes from a partial load (only some modules) back into the full
 * tree: classes from those modules are replaced, the rest stay as they were,
 * in their old order. New classes go at the end.
 */
export function mergePartial(full: TestTree, partial: TestTree, loadedModules: ReadonlySet<string>): TestTree {
	const fresh = new Map(partial.classes.map((c) => [c.id, c]));
	const classes: ClassRow[] = [];
	for (const cls of full.classes) {
		if (!loadedModules.has(cls.modulePath)) classes.push(cls);
		else if (fresh.has(cls.id)) {
			classes.push(fresh.get(cls.id)!);
			fresh.delete(cls.id);
		}
	}
	for (const cls of partial.classes) if (fresh.has(cls.id)) classes.push(cls);
	const loadFailures = [
		...full.loadFailures.filter((f) => !loadedModules.has(f.modulePath)),
		...partial.loadFailures,
	];
	return { classes, loadFailures };
}

/** The modules that hold these `Class.method` tests, or undefined if any class is unknown. */
export function modulesFor(tree: TestTree, names: readonly string[]): Set<string> | undefined {
	const moduleOf = new Map<string, string>();
	for (const cls of tree.classes) moduleOf.set(cls.name, cls.modulePath);
	const modules = new Set<string>();
	for (const name of names) {
		const [className] = name.match("^(.-)%.[^%.]+$");
		const modulePath = className !== undefined ? moduleOf.get(className as string) : undefined;
		if (modulePath === undefined) return undefined;
		modules.add(modulePath);
	}
	return modules;
}

/** Applies one class's results from a run. Rows the run did not include keep their status. */
export function applyResults(cls: ClassRow, results: CaseResult[]) {
	for (const result of results) {
		const row = cls.tests.find((test) => test.method === result.method.name && test.caseIndex === result.caseIndex);
		if (row === undefined) continue;
		row.status = result.passed ? "passed" : result.skipped ? "skipped" : "failed";
		row.message = result.passed ? undefined : result.errorMessage;
		row.elapsedMs = result.elapsedTimeMs;
	}
}

/** A class is failed if any test failed, passed if any passed, then skipped, then pending. */
export function classStatus(cls: ClassRow): Status {
	let passed = false;
	let skipped = false;
	let pending = false;
	for (const test of cls.tests) {
		if (test.status === "failed") return "failed";
		if (test.status === "passed") passed = true;
		else if (test.status === "skipped") skipped = true;
		else pending = true;
	}
	if (passed) return "passed";
	if (skipped && !pending) return "skipped";
	return "pending";
}

export interface Counts {
	passed: number;
	failed: number;
	skipped: number;
	pending: number;
}

export function countStatuses(tree: TestTree): Counts {
	const counts: Counts = { passed: 0, failed: 0, skipped: 0, pending: 0 };
	for (const cls of tree.classes) {
		for (const test of cls.tests) counts[test.status] += 1;
	}
	return counts;
}

export interface Query {
	words: string[];
	tags: string[];
}

/** Splits a search like `shop tag:smoke` into words and tags, lowercased. */
export function parseQuery(text: string): Query {
	const query: Query = { words: [], tags: [] };
	for (const [token] of text.lower().gmatch("%S+")) {
		const word = token as string;
		if (word.sub(1, 4) === "tag:" && word.size() > 4) query.tags.push(word.sub(5));
		else query.words.push(word);
	}
	return query;
}

function contains(haystack: string, needle: string): boolean {
	return haystack.lower().find(needle, 1, true)[0] !== undefined;
}

/**
 * Whether a test matches: every word appears in the class or test name or
 * label, and every tag is on the class or the test.
 */
export function matches(cls: ClassRow, test: TestRow, query: Query): boolean {
	const tags = [...cls.tags, ...test.tags].map((tag) => tag.lower());
	for (const tag of query.tags) {
		if (!tags.includes(tag)) return false;
	}
	const text = `${cls.name} ${cls.label} ${test.method} ${test.label}`;
	for (const word of query.words) {
		if (!contains(text, word)) return false;
	}
	return true;
}

export interface VisibleClass {
	cls: ClassRow;
	tests: TestRow[];
}

/** The classes and tests the search leaves visible. A class with no visible tests is hidden. */
export function visible(tree: TestTree, query: Query): VisibleClass[] {
	const out: VisibleClass[] = [];
	for (const cls of tree.classes) {
		const tests = cls.tests.filter((test) => matches(cls, test, query));
		if (tests.size() > 0) out.push({ cls, tests });
	}
	return out;
}

/** Lunit `tests` names (`Class.method`) for a set of rows, without duplicates. */
export function testNames(rows: VisibleClass[]): string[] {
	const names = new Set<string>();
	for (const { cls, tests } of rows) {
		for (const test of tests) names.add(`${cls.name}.${test.method}`);
	}
	const list: string[] = [];
	for (const name of names) list.push(name);
	return list;
}
