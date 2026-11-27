/** Creates an instance, sets its properties, and parents the children to it. */
export function make<T extends keyof CreatableInstances>(
	className: T,
	props: Partial<WritableInstanceProperties<CreatableInstances[T]>> = {},
	children: Instance[] = [],
): CreatableInstances[T] {
	const instance = new Instance(className);
	for (const [key, value] of pairs(props)) {
		(instance as unknown as Record<string, unknown>)[key as string] = value;
	}
	for (const child of children) child.Parent = instance;
	return instance;
}

export function padding(px: number): UIPadding {
	const offset = new UDim(0, px);
	return make("UIPadding", { PaddingLeft: offset, PaddingRight: offset, PaddingTop: offset, PaddingBottom: offset });
}
