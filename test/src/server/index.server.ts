import { TestRunner } from "@rbxts/lunit";
import { ReplicatedStorage } from "@rbxts/services";

const decoratorTestRunner = new TestRunner([ReplicatedStorage.Tests.shared]);

decoratorTestRunner.run({
	tags: ["Decorator"],
});
