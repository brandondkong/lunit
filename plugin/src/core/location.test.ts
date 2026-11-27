import { Assert, Test } from "@rbxts/lunit";
import { parseLocation, stripLocation } from "./location";

class TestLocation {
	@Test
	public readsAPlainChunkName() {
		Assert.deepEqual(parseLocation("ReplicatedStorage.TS.tests.shop.test:12: Expected 1 to equal 2"), {
			chunk: "ReplicatedStorage.TS.tests.shop.test",
			line: 12,
		});
	}

	@Test
	public readsAQuotedChunkName() {
		Assert.deepEqual(parseLocation('[string "out/shop.test.luau"]:3: boom'), {
			chunk: "out/shop.test.luau",
			line: 3,
		});
	}

	@Test
	public returnsUndefinedWithoutALocation() {
		Assert.equal(parseLocation("Test exceeded timeout of 100ms"), undefined);
		Assert.equal(parseLocation("Expected a: b to match"), undefined);
	}

	@Test
	public stripsTheLocation() {
		Assert.equal(stripLocation("Workspace.x.test:7: Expected true"), "Expected true");
		Assert.equal(stripLocation("no location here"), "no location here");
	}
}

export = TestLocation;
