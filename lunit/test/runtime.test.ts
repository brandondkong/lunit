import Assert from "../lib/assert";
import { Skip, Test } from "../lib/decorator";
import { Runtime } from "../lib/runtime";

class TestRuntime {
	@Test
	public exactlyOneRuntimeReportsTrue() {
		Assert.notEqual(Runtime.isRoblox(), Runtime.isLune());
	}

	@Skip(Runtime.isRoblox(), "Lune-only")
	@Test
	public underLuneIsRobloxFalse() {
		Assert.false(Runtime.isRoblox());
		Assert.true(Runtime.isLune());
	}

	@Skip(Runtime.isLune(), "Roblox-only")
	@Test
	public underRobloxIsRobloxTrue() {
		Assert.true(Runtime.isRoblox());
		Assert.false(Runtime.isLune());
	}
}

export = TestRuntime;
