import { Test } from "../../lib/decorator";

// Found by TestRunner.addRoot in runner.test.ts. The `.fixture` suffix keeps
// it out of the normal *.test / *.spec discovery.
class DiscoveredFixture {
	@Test
	public runs() {}
}

export = DiscoveredFixture;
