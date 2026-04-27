import { Lifecycle, MetadataKey } from "../shared/enums";
import { MethodMetadata, Method, BaseMetadata } from "../shared/types";

export function hasMetadata<T extends object>(ctor: T, key: MetadataKey): boolean {
	const ctorCast = ctor as Record<MetadataKey, object>;
	return ctorCast[key] !== undefined;
}

export function addMethodMetadata<T extends object>(
	ctor: T,
	name: string,
	transform: (metadata: MethodMetadata) => void,
): void {
	const ctorCast = ctor as Record<string, Map<string, Method> | undefined>;
	let methods = ctorCast[MetadataKey.Method];
	if (!methods) {
		methods = new Map();
		ctorCast[MetadataKey.Method] = methods;
	}

	const method = methods.get(name);
	if (method) {
		transform(method.options);
	} else {
		const newMethod: Method = { name, options: { lifecycles: [] } };
		transform(newMethod.options);
		methods.set(name, newMethod);
	}
}

export function getMethodMetadata<T extends object>(ctor: T, name: string): MethodMetadata | undefined {
	const ctorCast = ctor as Record<string, Map<string, Method> | undefined>;
	const methods = ctorCast[MetadataKey.Method];
	if (methods) {
		return methods.get(name)?.options;
	}

	return undefined;
}

export function addClassMetadata<T extends object>(ctor: T, transform: (options: BaseMetadata) => void): void {
	const ctorCast = ctor as Record<string, BaseMetadata | undefined>;
	if (!ctorCast[MetadataKey.Class]) {
		ctorCast[MetadataKey.Class] = {};
	}

	transform(ctorCast[MetadataKey.Class]);
}

export function getClassMetadata<T extends object>(ctor: T): BaseMetadata | undefined {
	const ctorCast = ctor as Record<string, BaseMetadata | undefined>;
	return ctorCast[MetadataKey.Class];
}

export function getLifecycleMethods<T extends object>(ctor: T, lifecycle: Lifecycle): Callback[] {
	const ctorCast = ctor as Record<string, Map<string, Method>>;
	const methods = ctorCast[MetadataKey.Method];

	const lifecycles: Callback[] = [];
	for (const [name, val] of methods) {
		if (val.options.lifecycles.includes(lifecycle)) {
			lifecycles.push((ctor as Record<string, Callback>)[name]);
		}
	}
	return lifecycles;
}
