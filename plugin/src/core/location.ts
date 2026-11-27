export interface SourceLocation {
	/** The chunk name: a ModuleScript's full name, or a file path under Lune. */
	chunk: string;
	line: number;
}

/**
 * Finds the `chunk:line:` that starts a Luau error message. Handles both
 * `ReplicatedStorage.TS.tests.shop.test:12: ...` and
 * `[string "ReplicatedStorage.TS.tests.shop.test"]:12: ...`.
 */
export function parseLocation(message: string): SourceLocation | undefined {
	const [quoted, quotedLine] = message.match('^%[string "(.-)"%]:(%d+):');
	if (quoted !== undefined) return { chunk: quoted as string, line: tonumber(quotedLine)! };
	const [plain, plainLine] = message.match("^([^:%s]+):(%d+):");
	if (plain !== undefined) return { chunk: plain as string, line: tonumber(plainLine)! };
	return undefined;
}

/** The message without its leading location, for showing next to the location. */
export function stripLocation(message: string): string {
	const location = parseLocation(message);
	if (location === undefined) return message;
	const [rest] = message.match("^.-:%d+:%s*(.*)$");
	return rest !== undefined ? (rest as string) : message;
}
