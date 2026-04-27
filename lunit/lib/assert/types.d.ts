export type AssertMessage = string | (() => string);

export interface AssertConstructor {
	equal<T>(actual: unknown, expected: T, message?: AssertMessage): void;
	notEqual<T>(actual: unknown, expected: T, message?: AssertMessage): void;
	deepEqual<T>(actual: unknown, expected: T, message?: AssertMessage): void;
	notDeepEqual<T>(actual: unknown, expected: T, message?: AssertMessage): void;

	true(actual: unknown, message?: AssertMessage): void;
	false(actual: unknown, message?: AssertMessage): void;
	undefined(actual: unknown, message?: AssertMessage): void;
	notUndefined(actual: unknown, message?: AssertMessage): void;

	greaterThan(actual: number, threshold: number, message?: AssertMessage): void;
	greaterThanOrEqual(actual: number, threshold: number, message?: AssertMessage): void;
	lessThan(actual: number, threshold: number, message?: AssertMessage): void;
	lessThanOrEqual(actual: number, threshold: number, message?: AssertMessage): void;
	between(actual: number, min: number, max: number, message?: AssertMessage): void;
	approximately(actual: number, expected: number, epsilon?: number, message?: AssertMessage): void;

	empty<T extends defined>(array: T[], message?: AssertMessage): void;
	notEmpty<T extends defined>(array: T[], message?: AssertMessage): void;
	contains<T extends defined>(
		array: T[],
		elementOrPredicate: T | ((element: T) => boolean),
		message?: AssertMessage,
	): void;
	doesNotContain<T extends defined>(
		array: T[],
		elementOrPredicate: T | ((element: T) => boolean),
		message?: AssertMessage,
	): void;

	match(actual: string, pattern: string, message?: AssertMessage): void;
	startsWith(actual: string, prefix: string, message?: AssertMessage): void;
	endsWith(actual: string, suffix: string, message?: AssertMessage): void;

	throws(callback: () => void, expectedMessage?: string, message?: AssertMessage): void;
	doesNotThrow(callback: () => void, message?: AssertMessage): void;
	fail(message?: AssertMessage): never;

	resolves<T>(promise: Promise<T>, message?: AssertMessage): void;
	rejects<T>(promise: Promise<T>, message?: AssertMessage): void;
	timeout<T>(promise: Promise<T>, durationInMilliseconds: number, message?: AssertMessage): Promise<void>;
}
