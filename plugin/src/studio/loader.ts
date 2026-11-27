const ScriptEditorService = game.GetService("ScriptEditorService");

type RequireFn = (target: unknown) => unknown;

/**
 * Loads ModuleScripts from their current source, ignoring Roblox's require
 * cache, so each run sees the code as it is now. Every module loaded through
 * one loader shares one cache, and its own `require` goes through the loader
 * too, so a test and everything it imports come from the same fresh load.
 *
 * Each chunk is named after the module's full name, so error messages read
 * `ReplicatedStorage.TS.tests.shop.test:12: ...` as they would in a game.
 */
export class ModuleLoader {
	private readonly cache = new Map<ModuleScript, unknown>();
	private readonly loading = new Set<ModuleScript>();
	/** Chunk name to module, for turning an error location back into a script. */
	public readonly modules = new Map<string, ModuleScript>();

	public require(module: ModuleScript): unknown {
		if (this.cache.has(module)) return this.cache.get(module);
		if (this.loading.has(module)) error(`cyclic require of ${module.GetFullName()}`, 2);

		const chunkName = module.GetFullName();
		// The prefix stays on line 1, so line numbers match the script.
		const [chunk, compileError] = loadstring(
			`local script, require = ...; ${ModuleLoader.sourceOf(module)}`,
			`=${chunkName}`,
		);
		if (chunk === undefined) error(`could not compile ${chunkName}: ${compileError}`, 2);

		this.modules.set(chunkName, module);
		this.loading.add(module);
		const requireFn: RequireFn = (target) =>
			typeIs(target, "Instance") && target.IsA("ModuleScript")
				? this.require(target)
				: (require as (t: unknown) => unknown)(target);
		const [ok, result] = pcall(chunk, module, requireFn);
		this.loading.delete(module);
		if (!ok) error(result, 0);

		this.cache.set(module, result);
		return result;
	}

	/** The text in the script editor, unsaved edits included; else the saved source. */
	private static sourceOf(module: ModuleScript): string {
		const [ok, source] = pcall(() => ScriptEditorService.GetEditorSource(module));
		return ok && typeIs(source, "string") ? source : module.Source;
	}
}

/** Whether this Studio lets plugins compile code. Without it, the plugin cannot load fresh modules. */
export function canLoadSource(): boolean {
	return typeIs(loadstring, "function");
}
