import Assert from "../lib/assert";
import { Test } from "../lib/decorator";

class TestAssert {
	@Test
	public equalPasses() {
		Assert.equal(1, 1);
		Assert.equal("a", "a");
		Assert.equal(true, true);
		Assert.equal(undefined, undefined);
	}

	@Test
	public equalThrows() {
		Assert.throws(() => Assert.equal(1, 2));
		Assert.throws(() => Assert.equal("a", "b"));
	}

	@Test
	public notEqual() {
		Assert.notEqual(1, 2);
		Assert.throws(() => Assert.notEqual(1, 1));
	}

	@Test
	public deepEqualPrimitives() {
		Assert.deepEqual(1, 1);
		Assert.deepEqual("x", "x");
		Assert.throws(() => Assert.deepEqual(1, 2));
	}

	@Test
	public deepEqualNestedTables() {
		Assert.deepEqual({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 2 } });
		Assert.deepEqual([1, 2, 3], [1, 2, 3]);
	}

	@Test
	public deepEqualMismatchPath() {
		Assert.throws(() => Assert.deepEqual({ a: { b: 1 } }, { a: { b: 2 } }), "a.b");
	}

	@Test
	public deepEqualMissingKey() {
		Assert.throws(() => Assert.deepEqual({ a: 1, b: 2 }, { a: 1 }));
		Assert.throws(() => Assert.deepEqual({ a: 1 }, { a: 1, b: 2 }));
	}

	@Test
	public notDeepEqual() {
		Assert.notDeepEqual({ a: 1 }, { a: 2 });
		Assert.throws(() => Assert.notDeepEqual({ a: 1 }, { a: 1 }));
	}

	@Test
	public booleanAsserts() {
		Assert.true(true);
		Assert.false(false);
		Assert.throws(() => Assert.true(false));
		Assert.throws(() => Assert.true(1 as unknown as boolean));
		Assert.throws(() => Assert.false(true));
	}

	@Test
	public undefinedAsserts() {
		Assert.undefined(undefined);
		Assert.notUndefined(0);
		Assert.notUndefined(false);
		Assert.notUndefined("");
		Assert.throws(() => Assert.undefined(0));
		Assert.throws(() => Assert.notUndefined(undefined));
	}

	@Test
	public numericComparisons() {
		Assert.greaterThan(2, 1);
		Assert.greaterThanOrEqual(2, 2);
		Assert.lessThan(1, 2);
		Assert.lessThanOrEqual(2, 2);
		Assert.throws(() => Assert.greaterThan(1, 2));
		Assert.throws(() => Assert.lessThan(2, 1));
	}

	@Test
	public between() {
		Assert.between(5, 0, 10);
		Assert.between(0, 0, 10);
		Assert.between(10, 0, 10);
		Assert.throws(() => Assert.between(11, 0, 10));
	}

	@Test
	public approximately() {
		Assert.approximately(0.1 + 0.2, 0.3);
		Assert.approximately(1, 1.05, 0.1);
		Assert.throws(() => Assert.approximately(1, 2));
		Assert.throws(() => Assert.approximately(1, 1.5, 0.1));
	}

	@Test
	public emptyAsserts() {
		Assert.empty([]);
		Assert.notEmpty([1]);
		Assert.throws(() => Assert.empty([1]));
		Assert.throws(() => Assert.notEmpty([]));
	}

	@Test
	public containsValue() {
		Assert.contains([1, 2, 3], 2);
		Assert.doesNotContain([1, 2, 3], 4);
		Assert.throws(() => Assert.contains([1, 2, 3], 4));
		Assert.throws(() => Assert.doesNotContain([1, 2, 3], 2));
	}

	@Test
	public containsPredicate() {
		Assert.contains([1, 2, 3], (n) => n > 2);
		Assert.doesNotContain([1, 2, 3], (n) => n > 10);
	}

	@Test
	public match() {
		Assert.match("hello world", "^hello");
		Assert.match("foo123", "%d+");
		Assert.throws(() => Assert.match("hello", "^world"));
	}

	@Test
	public startsAndEndsWith() {
		Assert.startsWith("hello world", "hello");
		Assert.endsWith("hello world", "world");
		Assert.throws(() => Assert.startsWith("hello", "world"));
		Assert.throws(() => Assert.endsWith("hello", "world"));
	}

	@Test
	public throwsWithMessage() {
		Assert.throws(() => error("boom happened"), "boom");
		Assert.throws(() => Assert.throws(() => error("boom"), "missing"));
	}

	@Test
	public throwsWhenCallbackDoesNotThrow() {
		Assert.throws(() => Assert.throws(() => {}));
	}

	@Test
	public doesNotThrow() {
		Assert.doesNotThrow(() => 1 + 1);
		Assert.throws(() => Assert.doesNotThrow(() => error("boom")));
	}

	@Test
	public failAlwaysThrows() {
		Assert.throws(() => Assert.fail());
		Assert.throws(() => Assert.fail("custom"), "custom");
	}

	@Test
	public messageCanBeFunction() {
		Assert.throws(() => Assert.equal(1, 2, () => "lazy message"), "lazy message");
	}

	@Test
	public resolves() {
		Assert.resolves(Promise.resolve(1));
		Assert.throws(() => Assert.resolves(Promise.reject("nope")));
	}

	@Test
	public rejects() {
		Assert.rejects(Promise.reject("nope"));
		Assert.throws(() => Assert.rejects(Promise.resolve(1)));
	}
}

export = TestAssert;
