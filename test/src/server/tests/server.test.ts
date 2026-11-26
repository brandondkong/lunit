import { Assert, Test } from "@rbxts/lunit";
import { makeHello } from "shared/module";

// Lives under ServerScriptService.TS, a different Rojo mount than the shared module.
class ServerMountImports {
	@Test
	public resolvesAcrossMounts() {
		Assert.equal(makeHello("server"), "Hello from server!");
	}
}

export = ServerMountImports;
