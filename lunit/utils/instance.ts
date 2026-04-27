export function getDescendantsOfType<T extends keyof Objects>(root: Instance, className: T): Objects[T][] {
	const res: Objects[T][] = [];

	for (const descendant of root.GetDescendants()) {
		if (descendant.IsA(className)) {
			res.push(descendant);
		}
	}

	return res;
}
