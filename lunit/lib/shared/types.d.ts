import { Lifecycle } from "./enums";

export type MethodConstructor<T = object> = (ctor: T, propertyKey?: string) => void;

interface ValueWithMessage<T> {
	value: T;
	message?: string;
}

export interface BaseMetadata {
	displayName?: string;
	disabled?: ValueWithMessage<boolean>;
	order?: number;
	tags?: string[];
	only?: boolean;
}

export interface MethodMetadata extends BaseMetadata {
	lifecycles: Lifecycle[];
	negated?: boolean;
	isTest?: boolean;
	timeout?: number;
	cases?: ReadonlyArray<ReadonlyArray<unknown>>;
	retries?: number;
	repeats?: number;
}

export type Method = {
	name: string;
	options: MethodMetadata;
};

/**
 * Represents a generic exception with a message.
 */
export interface Exception {
	/**
	 * The message describing the exception.
	 */
	readonly message: string;

	/**
	 * Converts the exception to a string representation.
	 * @returns A string representation of the exception.
	 */
	toString(): string;
}
