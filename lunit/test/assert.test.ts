import Assert from "../lib/assert";
import { Test } from "../lib/decorator";

class TestAssert {
	@Test
	public testAssertThrows() {
		Assert.throws(() => {
			throw "Should throw error";
		});
	}

	@Test
	public testAssertEquals() {
		Assert.doesNotThrow(() => {
			Assert.equal(1, 1);
		});
		Assert.throws(() => {
			Assert.equal(1, 2);
		});
	}
}

export = TestAssert;
