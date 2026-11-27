import { Assert, Test } from "@rbxts/lunit";
import { classify, Shop, Size } from "../coverage/shop";

// Runs part of coverage/shop.ts, so that check-coverage.js can compare the
// lines that ran with the markers in that file.
class TestCoverageFixture {
	@Test
	public pricesApple() {
		Assert.equal(new Shop("s").price("apple"), 1);
	}

	@Test
	public labelsSmall() {
		Assert.equal(new Shop("s").label(Size.Small), "small");
	}

	@Test
	public classifies() {
		Assert.equal(classify(3), "large");
		Assert.equal(classify(-1), "negative");
	}
}

export = TestCoverageFixture;
