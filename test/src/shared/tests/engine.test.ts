import { Assert, Runtime, Tag, Test } from "@rbxts/lunit";

// Under Lune, `game` is a real Lune DataModel and datatypes come from
// @lune/roblox. These tests check that the stand-ins match Roblox.
class LuneEngine {
	@Test
	public gameIsADataModelButRuntimeIsLune() {
		Assert.true(typeIs(game, "Instance"));
		Assert.true(game.IsA("DataModel"));
		Assert.true(Runtime.isLune());
	}

	@Test
	public scriptIsAModuleScript() {
		Assert.true(script.IsA("ModuleScript"));
		Assert.equal(script.Name, "engine.test");
	}

	@Test
	public datatypesWork() {
		const v = new Vector3(1, 2, 3).add(new Vector3(1, 1, 1));
		Assert.equal(v.Y, 3);
		Assert.equal(new CFrame(0, 5, 0).Position.Y, 5);
		Assert.equal(Enum.KeyCode.A.Name, "A");
	}

	@Test
	public anyServiceExists() {
		Assert.true(game.GetService("Players").IsA("Players"));
		Assert.true(game.GetService("TextChatService").IsA("TextChatService"));
	}

	@Test
	public runServiceReportsNoStudioClientOrServer() {
		const runService = game.GetService("RunService");
		Assert.false(runService.IsStudio());
		Assert.false(runService.IsClient());
		Assert.false(runService.IsServer());
	}

	@Test
	public httpServiceJsonRoundTrips() {
		const http = game.GetService("HttpService");
		const decoded = http.JSONDecode(http.JSONEncode({ a: 1 })) as { a: number };
		Assert.equal(decoded.a, 1);
		Assert.equal(http.GenerateGUID(false).size(), 36);
	}

	@Test
	public waitForChildFailsInsteadOfHanging() {
		const folder = new Instance("Folder");
		Assert.equal(folder.WaitForChild("Missing", 1), undefined);
		Assert.throws(() => folder.WaitForChild("Missing"));
	}

	@Test
	public generatorsWork() {
		function* count() {
			yield 1;
			yield 2;
		}
		const values: number[] = [];
		for (const value of count()) {
			values.push(value);
		}
		Assert.equal(values.size(), 2);
	}

	@Test
	public setupFileRan() {
		const folder = game.GetService("Workspace").FindFirstChild("FromSetup");
		Assert.notEqual(folder, undefined);
		Assert.equal(folder?.GetAttribute("count"), 1);
	}

	// Runtime tag: skipped under Lune (reported as "Roblox only"), so the
	// error below never runs here.
	@Tag("Roblox")
	@Test
	public robloxOnlyTestIsSkipped() {
		error("a Roblox-only test ran under Lune");
	}
}

export = LuneEngine;
