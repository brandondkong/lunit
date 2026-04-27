import { BaseMetadata, MethodMetadata } from "../shared/types";
import { MethodConstructor } from "../shared/types";
import { addMethodMetadata, addClassMetadata } from "../metadata/utils";

export function createSharedDecorator<T extends object>(
	callback: (metadata: BaseMetadata) => void,
): MethodConstructor<T> {
	return function (ctor: T, propertyKey?: string): void {
		if (ctor === undefined) throw "target cannot be undefined";
		else if (propertyKey !== undefined) addMethodMetadata(ctor, propertyKey, callback);
		else addClassMetadata(ctor, callback);
	};
}

export function createMethodDecorator<T extends object>(
	callback: (metadata: MethodMetadata) => void,
): MethodConstructor<T> {
	return function (ctor: T, propertyKey?: string): void {
		if (ctor === undefined) throw "target cannot be undefined";
		else if (propertyKey !== undefined) addMethodMetadata(ctor, propertyKey, callback);
	};
}
