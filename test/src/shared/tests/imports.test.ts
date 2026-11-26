import { Assert, Runtime, Test } from "@rbxts/lunit";
import { makeHello } from "shared/module";
import { GREETING } from "./greeting";

// Game projects compile imports to game:GetService(...) paths and load the
// runtime through require(RuntimeLib). These tests fail to load at all if the
// Lune runner cannot resolve that output through default.project.json.
class GameProjectImports {
	@Test
	public resolvesServiceRootedImport() {
		Assert.equal(makeHello("lune"), "Hello from lune!");
	}

	@Test
	public resolvesRelativeImport() {
		Assert.equal(GREETING, "hi");
	}

	@Test
	public runtimeReportsLune() {
		Assert.true(Runtime.isLune());
	}
}

export = GameProjectImports;
