// Coverage fixture. Each statement line ends with `// hit` or `// miss`:
// whether the tests in tests/coverage.test.ts run it. check-coverage.js
// compares these markers with coverage/lcov.info.

export const enum Size {
	Small = 1,
	Large = 2,
}

class Base { // hit
	constructor(public readonly name: string) {}
}

export class Shop extends Base { // hit
	private items = new Map<string, number>();

	constructor(name: string) {
		super(name); // hit
		this.items.set("apple", 1); // hit
	}

	public price(item: string): number {
		const value = this.items.get(item); // hit
		if (value === undefined) error(`no item ${item}`); // hit
		return value; // hit
	}

	public label(size: Size): string {
		switch (size) { // hit
			case Size.Small:
				return "small"; // hit
			case Size.Large:
				return "large"; // miss
			default:
				return "unknown"; // miss
		}
	}
}

export function classify(n: number): string {
	if (n < 0) { // hit
		return "negative"; // hit
	} else if (n === 0) return "zero"; // miss
	let total = 0; // hit
	for (let i = 0; i < n; i++) total += i; // hit
	try { // hit
		if (n > 1000) throw "too big"; // hit
	} catch (e) {
		return "caught"; // miss
	}
	const found = [1, 2, 3].find((x) => { // hit
		return x > total; // hit
	});
	return found !== undefined ? "small" : "large"; // hit
}

export namespace Helpers { // hit
	export const prefix = "!"; // hit
	export function shout(s: string) {
		return s.upper() + prefix; // miss
	}
}
