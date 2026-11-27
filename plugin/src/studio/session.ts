import type { CoverageReport, LunitModule, Runner } from "../core/lunit";
import {
	applyResults,
	buildTree,
	DiscoveredClass,
	keepState,
	LoadFailure,
	mergePartial,
	modulesFor,
	TestTree,
} from "../core/tree";
import { findLunit, findRuntimeLib, findTestModules } from "./discovery";
import { ModuleLoader } from "./loader";

const ChangeHistoryService = game.GetService("ChangeHistoryService");

interface RuntimeLib {
	import: (this: void, context: Instance, module: Instance) => unknown;
}

export interface RunSummary {
	passed: number;
	failed: number;
	skipped: number;
	elapsedMs: number;
}

export interface Outcome {
	error?: string;
	/** Set when the run could not be undone, so tests may have left changes in the place. */
	warning?: string;
}

interface Loaded {
	loader: ModuleLoader;
	runner: Runner;
	discovered: DiscoveredClass[];
	failures: LoadFailure[];
}

/**
 * Runs `fn` inside a ChangeHistoryService recording, then cancels the
 * recording, so instances that test modules create or change are put back.
 * Returns a warning when no recording could start (for example in Play mode).
 */
function withUndo(fn: () => void): string | undefined {
	const [, id] = pcall(() => ChangeHistoryService.TryBeginRecording("Lunit test run"));
	const [ok, err] = pcall(fn);
	if (typeIs(id, "string")) {
		ChangeHistoryService.FinishRecording(id, Enum.FinishRecordingOperation.Cancel);
	}
	if (!ok) error(err, 0);
	return typeIs(id, "string")
		? undefined
		: "Studio could not record this run, so changes the tests made to the place were not undone.";
}

/** The state of one Studio session: the current test tree and the last run. */
export class Session {
	public tree?: TestTree;
	public coverage?: CoverageReport;
	public summary?: RunSummary;
	/** Output from the last run: Lunit's report, and coverage when asked for. */
	public output: string[] = [];
	private loader?: ModuleLoader;

	/**
	 * Loads Lunit and the test modules from their current source: every test
	 * module, or only those whose full names are in `only`.
	 */
	private load(only?: ReadonlySet<string>): Loaded {
		const lunitModule = findLunit();
		if (lunitModule === undefined) {
			error(
				"Lunit was not found in this place. Install @rbxts/lunit and sync it with Rojo " +
					"(it lives under rbxts_include/node_modules/@rbxts/lunit).",
				0,
			);
		}
		// roblox-ts runtimes register modules at _G[module] and refuse a module
		// another runtime registered. Each load makes a fresh runtime, so drop
		// what earlier loads registered for the place's modules. Modules of
		// other plugins are not in the place and stay.
		for (const [key] of pairs(_G as unknown as Map<unknown, unknown>)) {
			if (typeIs(key, "Instance") && key.IsDescendantOf(game)) rawset(_G, key, undefined);
		}

		const loader = new ModuleLoader();
		// Lunit is a package, so import it through the project's runtime, as the
		// tests do. The runtime script itself is the importing context.
		const runtime = findRuntimeLib(lunitModule);
		const lunit = (
			runtime !== undefined
				? (loader.require(runtime) as RuntimeLib).import(runtime, lunitModule)
				: loader.require(lunitModule)
		) as LunitModule;

		const failures: LoadFailure[] = [];
		const moduleOf = new Map<unknown, ModuleScript>();
		const classes: defined[] = [];
		for (const module of findTestModules()) {
			if (only !== undefined && !only.has(module.GetFullName())) continue;
			const [ok, value] = pcall(() => loader.require(module));
			if (!ok) failures.push({ modulePath: module.GetFullName(), message: tostring(value) });
			else if (value === undefined)
				failures.push({ modulePath: module.GetFullName(), message: "returned nothing" });
			else {
				classes.push(value as defined);
				moduleOf.set(value, module);
			}
		}

		const runner = lunit.TestRunner.fromClasses(classes);
		if (runner.describe === undefined) {
			error("This plugin needs @rbxts/lunit 4.4 or later in the place. Update it and sync again.", 0);
		}
		const discovered = runner.describe().classes.map((plan) => ({
			modulePath: moduleOf.get(plan.testClass)?.GetFullName() ?? plan.name,
			plan,
		}));
		return { loader, runner, discovered, failures };
	}

	/** Finds the tests without running them. Statuses from earlier runs are kept. */
	public discover(): Outcome {
		const outcome: Outcome = {};
		const [ok, err] = pcall(() => {
			outcome.warning = withUndo(() => {
				const loaded = this.load();
				this.loader = loaded.loader;
				this.tree = keepState(buildTree(loaded.discovered, loaded.failures), this.tree);
			});
		});
		if (!ok) outcome.error = tostring(err);
		return outcome;
	}

	/**
	 * Runs tests from their current source. `tests` are exact `Class.method`
	 * names; undefined runs everything. With `coverage`, line counts come back
	 * when the synced build was made with @rbxts/lunit/transformer.
	 */
	public run(tests: string[] | undefined, coverage: boolean): Outcome {
		const outcome: Outcome = {};
		const [ok, err] = pcall(() => {
			outcome.warning = withUndo(() => {
				// Instrumented modules register their counts again as they load.
				(_G as { __lunitCoverage?: unknown }).__lunitCoverage = undefined;
				// A selection loads only its own test modules, so coverage lists just
				// the files those tests import, and the run is faster.
				const only = tests !== undefined && this.tree !== undefined ? modulesFor(this.tree, tests) : undefined;
				const loaded = this.load(only);
				this.loader = loaded.loader;
				const output: string[] = [];
				const result = loaded.runner
					.run({ tests, coverage, reporter: { output: (text) => output.push(text) } })
					.expect();

				const loadedTree = keepState(buildTree(loaded.discovered, loaded.failures), this.tree);
				const tree =
					only !== undefined && this.tree !== undefined
						? mergePartial(this.tree, loadedTree, only)
						: loadedTree;
				const rowFor = new Map<unknown, (typeof tree.classes)[number]>();
				loaded.discovered.forEach((entry, index) =>
					rowFor.set(entry.plan.testClass, loadedTree.classes[index]),
				);
				for (const [testClass, classResult] of result.tests) {
					const row = rowFor.get(testClass);
					if (row !== undefined) applyResults(row, classResult.tests);
				}
				this.tree = tree;
				this.output = output;
				this.coverage = coverage ? result.coverage : undefined;
				this.summary = {
					passed: result.numTestsPassed,
					failed: result.numTestsFailed,
					skipped: result.numTestsSkipped,
					elapsedMs: result.elapsedTimeMs,
				};
			});
		});
		if (!ok) outcome.error = tostring(err);
		return outcome;
	}

	/** The ModuleScript an error location names, from the last load. */
	public moduleForChunk(chunk: string): ModuleScript | undefined {
		return this.loader?.modules.get(chunk);
	}
}
