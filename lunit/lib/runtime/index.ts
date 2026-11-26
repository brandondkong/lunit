/**
 * Pair with `@Skip` to gate tests on the host runtime — e.g.
 * `@Skip(!Runtime.isRoblox(), "Roblox only")`. Detection is by global
 * `game`: present-as-Instance ⇒ Roblox; otherwise treated as non-Roblox.
 * Lunit's Lune runner gives `game` a real Lune DataModel, so it also sets
 * `_G.__LUNIT_LUNE`, which counts as non-Roblox.
 */

function isRoblox(): boolean {
	return typeIs(game, "Instance") && (_G as { __LUNIT_LUNE?: boolean }).__LUNIT_LUNE !== true;
}

function isLune(): boolean {
	return !isRoblox();
}

export const Runtime = {
	isRoblox,
	isLune,
};

export default Runtime;
