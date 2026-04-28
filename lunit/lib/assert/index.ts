import { AssertConstructor, AssertMessage } from "./types";

function resolveMessage(message: AssertMessage): string {
	return typeIs(message, "string") ? message : message();
}

function fail(fallbackMessage: string, message?: AssertMessage): never {
	throw message !== undefined ? resolveMessage(message) : fallbackMessage;
}

interface Diff {
	path: string;
	actual: unknown;
	expected: unknown;
}

const MISSING = "<missing>";

function appendPath(parent: string, key: unknown): string {
	if (typeIs(key, "number")) return `${parent}[${key}]`;
	if (typeIs(key, "string")) return parent === "" ? key : `${parent}.${key}`;
	return `${parent}[${tostring(key)}]`;
}

function collectDiffs(actual: unknown, expected: unknown, path: string, out: Diff[]): void {
	if (actual === expected) return;
	if (!typeIs(actual, "table") || !typeIs(expected, "table")) {
		out.push({ path: path === "" ? "<root>" : path, actual, expected });
		return;
	}

	const actualMap = actual as Map<unknown, unknown>;
	const expectedMap = expected as Map<unknown, unknown>;

	for (const [key, actualVal] of actualMap) {
		const childPath = appendPath(path, key);
		if (!expectedMap.has(key)) {
			out.push({ path: childPath, actual: actualVal, expected: MISSING });
		} else {
			collectDiffs(actualVal, expectedMap.get(key), childPath, out);
		}
	}
	for (const [key, expectedVal] of expectedMap) {
		if (!actualMap.has(key)) {
			out.push({ path: appendPath(path, key), actual: MISSING, expected: expectedVal });
		}
	}
}

const MAX_DIFFS_SHOWN = 5;

function formatDiffs(diffs: Diff[]): string {
	const shown = math.min(diffs.size(), MAX_DIFFS_SHOWN);
	const lines: string[] = ["deepEqual mismatch:"];
	for (let i = 0; i < shown; i++) {
		const d = diffs[i];
		lines.push(`  at ${d.path}: actual = ${tostring(d.actual)}, expected = ${tostring(d.expected)}`);
	}
	if (diffs.size() > MAX_DIFFS_SHOWN) {
		lines.push(`  ...and ${diffs.size() - MAX_DIFFS_SHOWN} more`);
	}
	return lines.join("\n");
}

function isDeepEqual(a: unknown, b: unknown): boolean {
	const diffs: Diff[] = [];
	collectDiffs(a, b, "", diffs);
	return diffs.size() === 0;
}

const Assert = {
	/**
	 * Asserts strict (`===`) equality.
	 * @example Assert.equal(1, 1);
	 */
	equal<T>(actual: unknown, expected: T, message?: AssertMessage): void {
		if (actual !== expected) {
			fail(`Expected ${tostring(actual)} to equal ${tostring(expected)}`, message);
		}
	},

	/**
	 * Asserts strict (`!==`) inequality.
	 */
	notEqual<T>(actual: unknown, expected: T, message?: AssertMessage): void {
		if (actual === expected) {
			fail(`Expected ${tostring(actual)} to not equal ${tostring(expected)}`, message);
		}
	},

	/**
	 * Asserts structural equality. Recurses into tables, comparing keys and values.
	 * Primitives, Roblox datatypes (Vector3, CFrame, ...) and Instances compare by `===`.
	 * On failure, the message includes the path to each mismatch.
	 * @example Assert.deepEqual({ a: 1, b: [2, 3] }, { a: 1, b: [2, 3] });
	 */
	deepEqual<T>(actual: unknown, expected: T, message?: AssertMessage): void {
		const diffs: Diff[] = [];
		collectDiffs(actual, expected, "", diffs);
		if (diffs.size() > 0) {
			fail(formatDiffs(diffs), message);
		}
	},

	/**
	 * Asserts structural inequality.
	 */
	notDeepEqual<T>(actual: unknown, expected: T, message?: AssertMessage): void {
		if (isDeepEqual(actual, expected)) {
			fail(`Expected ${tostring(actual)} to not deeply equal ${tostring(expected)}`, message);
		}
	},

	/**
	 * Asserts the value is exactly `true`.
	 */
	true(actual: unknown, message?: AssertMessage): void {
		if (actual !== true) {
			fail(`Expected ${tostring(actual)} to be true`, message);
		}
	},

	/**
	 * Asserts the value is exactly `false`.
	 */
	false(actual: unknown, message?: AssertMessage): void {
		if (actual !== false) {
			fail(`Expected ${tostring(actual)} to be false`, message);
		}
	},

	/**
	 * Asserts the value is `undefined` (nil).
	 */
	undefined(actual: unknown, message?: AssertMessage): void {
		if (actual !== undefined) {
			fail(`Expected ${tostring(actual)} to be undefined`, message);
		}
	},

	/**
	 * Asserts the value is defined (not `undefined`/nil).
	 */
	notUndefined(actual: unknown, message?: AssertMessage): void {
		if (actual === undefined) {
			fail("Expected value to be defined", message);
		}
	},

	greaterThan(actual: number, threshold: number, message?: AssertMessage): void {
		if (actual <= threshold) {
			fail(`Expected ${actual} to be greater than ${threshold}`, message);
		}
	},

	greaterThanOrEqual(actual: number, threshold: number, message?: AssertMessage): void {
		if (actual < threshold) {
			fail(`Expected ${actual} to be greater than or equal to ${threshold}`, message);
		}
	},

	lessThan(actual: number, threshold: number, message?: AssertMessage): void {
		if (actual >= threshold) {
			fail(`Expected ${actual} to be less than ${threshold}`, message);
		}
	},

	lessThanOrEqual(actual: number, threshold: number, message?: AssertMessage): void {
		if (actual > threshold) {
			fail(`Expected ${actual} to be less than or equal to ${threshold}`, message);
		}
	},

	between(actual: number, min: number, max: number, message?: AssertMessage): void {
		if (actual < min || actual > max) {
			fail(`Expected ${actual} to be between ${min} and ${max}`, message);
		}
	},

	/**
	 * Asserts two numbers are within `epsilon` of each other. Default epsilon is `1e-6`.
	 * @example Assert.approximately(0.1 + 0.2, 0.3);
	 */
	approximately(actual: number, expected: number, epsilon: number = 1e-6, message?: AssertMessage): void {
		if (math.abs(actual - expected) > epsilon) {
			fail(`Expected ${actual} to be approximately ${expected} (±${epsilon})`, message);
		}
	},

	empty<T extends defined>(array: T[], message?: AssertMessage): void {
		if (array.size() !== 0) {
			fail(`Expected array to be empty, got size ${array.size()}`, message);
		}
	},

	notEmpty<T extends defined>(array: T[], message?: AssertMessage): void {
		if (array.size() === 0) {
			fail("Expected array to not be empty", message);
		}
	},

	/**
	 * Asserts an array contains a value, or an element matching a predicate.
	 * @example Assert.contains([1, 2, 3], 2);
	 * @example Assert.contains([1, 2, 3], (n) => n > 2);
	 */
	contains<T extends defined>(
		array: T[],
		elementOrPredicate: T | ((element: T) => boolean),
		message?: AssertMessage,
	): void {
		const found = typeIs(elementOrPredicate, "function")
			? array.some(elementOrPredicate)
			: array.includes(elementOrPredicate);
		if (!found) {
			fail("Expected array to contain element", message);
		}
	},

	/**
	 * Asserts an array does not contain a value, or no element matches a predicate.
	 */
	doesNotContain<T extends defined>(
		array: T[],
		elementOrPredicate: T | ((element: T) => boolean),
		message?: AssertMessage,
	): void {
		const found = typeIs(elementOrPredicate, "function")
			? array.some(elementOrPredicate)
			: array.includes(elementOrPredicate);
		if (found) {
			fail("Expected array to not contain element", message);
		}
	},

	/**
	 * Asserts a string matches a Lua pattern.
	 * @example Assert.match("hello world", "^hello");
	 */
	match(actual: string, pattern: string, message?: AssertMessage): void {
		if (actual.match(pattern)[0] === undefined) {
			fail(`Expected "${actual}" to match pattern "${pattern}"`, message);
		}
	},

	startsWith(actual: string, prefix: string, message?: AssertMessage): void {
		if (actual.sub(1, prefix.size()) !== prefix) {
			fail(`Expected "${actual}" to start with "${prefix}"`, message);
		}
	},

	endsWith(actual: string, suffix: string, message?: AssertMessage): void {
		if (actual.sub(actual.size() - suffix.size() + 1) !== suffix) {
			fail(`Expected "${actual}" to end with "${suffix}"`, message);
		}
	},

	/**
	 * Asserts the callback throws. Optionally checks the thrown message contains a substring.
	 * @example Assert.throws(() => error("boom"));
	 * @example Assert.throws(() => error("boom"), "boom");
	 */
	throws(callback: () => void, expectedMessage?: string, message?: AssertMessage): void {
		try {
			callback();
		} catch (e) {
			if (expectedMessage === undefined) return;
			const errorString = tostring(e);
			if (errorString.find(expectedMessage, 1, true)[0] !== undefined) return;
			fail(`Expected error to contain "${expectedMessage}", got "${errorString}"`, message);
		}
		fail("Expected callback to throw, but it did not", message);
	},

	doesNotThrow(callback: () => void, message?: AssertMessage): void {
		try {
			callback();
		} catch (e) {
			fail(`Expected callback to not throw, threw: ${tostring(e)}`, message);
		}
	},

	/**
	 * Explicitly fails an assertion. Useful for unreachable branches.
	 */
	fail(message?: AssertMessage): never {
		throw message !== undefined ? resolveMessage(message) : "Assertion failed";
	},

	resolves<T>(promise: Promise<T>, message?: AssertMessage): void {
		const [status] = promise.awaitStatus();
		if (status !== Promise.Status.Resolved) {
			fail(`Expected promise to resolve, instead it ${status}`, message);
		}
	},

	rejects<T>(promise: Promise<T>, message?: AssertMessage): void {
		const [status] = promise.awaitStatus();
		if (status !== Promise.Status.Rejected) {
			fail(`Expected promise to reject, instead it ${status}`, message);
		}
	},

	timeout<T>(promise: Promise<T>, durationInMilliseconds: number, message?: AssertMessage): void {
		const [status] = promise.timeout(durationInMilliseconds / 1000).awaitStatus();
		if (status !== Promise.Status.Resolved) {
			fail(`Expected promise to resolve within ${durationInMilliseconds}ms`, message);
		}
	},
} satisfies AssertConstructor;

export default Assert;
