/** Services that can hold test modules. CoreGui and the like are left out. */
const ROOTS = [
	"ReplicatedStorage",
	"ReplicatedFirst",
	"ServerScriptService",
	"ServerStorage",
	"StarterPlayer",
	"StarterGui",
	"Workspace",
] as const;

const TEST_PATTERNS = ["%.test$", "%.spec$"];

function isTestModule(instance: Instance): instance is ModuleScript {
	if (!instance.IsA("ModuleScript")) return false;
	if (!TEST_PATTERNS.some((pattern) => instance.Name.match(pattern)[0] !== undefined)) return false;
	// Tests that ship inside packages are not the project's.
	let parent = instance.Parent;
	while (parent !== undefined) {
		if (parent.Name === "node_modules" || parent.Name === "_Index") return false;
		parent = parent.Parent;
	}
	return true;
}

/** Every `*.test` / `*.spec` ModuleScript in the place, sorted by full name. */
export function findTestModules(): ModuleScript[] {
	const found: ModuleScript[] = [];
	for (const name of ROOTS) {
		const [ok, service] = pcall(() => game.GetService(name));
		if (!ok || service === undefined) continue;
		for (const descendant of (service as Instance).GetDescendants()) {
			if (isTestModule(descendant)) found.push(descendant);
		}
	}
	found.sort((a, b) => a.GetFullName() < b.GetFullName());
	return found;
}

/**
 * The project's own copy of Lunit: the `out` ModuleScript of
 * `node_modules/@rbxts/lunit`, where Rojo puts it for a roblox-ts game.
 */
export function findLunit(): ModuleScript | undefined {
	for (const name of ROOTS) {
		const [ok, service] = pcall(() => game.GetService(name));
		if (!ok || service === undefined) continue;
		for (const descendant of (service as Instance).GetDescendants()) {
			if (
				descendant.Name === "lunit" &&
				descendant.Parent?.Name === "@rbxts" &&
				descendant.FindFirstChild("out")?.IsA("ModuleScript")
			) {
				return descendant.FindFirstChild("out") as ModuleScript;
			}
		}
	}
	return undefined;
}

/**
 * The roblox-ts runtime that the project's packages expect at `_G[script]`:
 * the nearest `RuntimeLib` above Lunit (`rbxts_include.RuntimeLib` in a game).
 */
export function findRuntimeLib(lunit: ModuleScript): ModuleScript | undefined {
	let parent = lunit.Parent;
	while (parent !== undefined) {
		const runtime = parent.FindFirstChild("RuntimeLib");
		if (runtime !== undefined && runtime.IsA("ModuleScript")) return runtime;
		parent = parent.Parent;
	}
	return undefined;
}
