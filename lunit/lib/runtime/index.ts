/**
 * Pair with `@Skip` to gate tests on the host runtime — e.g.
 * `@Skip(!Runtime.isRoblox(), "Roblox only")`. Detection is by global
 * `game`: present-as-Instance ⇒ Roblox; otherwise treated as non-Roblox.
 */

function isRoblox(): boolean {
	return typeIs(game, "Instance");
}

function isLune(): boolean {
	return !isRoblox();
}

export const Runtime = {
	isRoblox,
	isLune,
};

export default Runtime;
