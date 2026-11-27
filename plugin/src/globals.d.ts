/**
 * Compiles Luau source into a function. Plugins may call it. The function
 * gets the caller's global environment.
 */
declare function loadstring(
	source: string,
	chunkName?: string,
): LuaTuple<[((...args: unknown[]) => unknown) | undefined, string | undefined]>;
