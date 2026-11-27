import { Assert, Test } from "@rbxts/lunit";
import type { PlanClass } from "./lunit";
import {
	applyResults,
	buildTree,
	classStatus,
	countStatuses,
	keepState,
	mergePartial,
	modulesFor,
	parseQuery,
	testNames,
	visible,
} from "./tree";

function shopPlan(): PlanClass {
	return {
		testClass: {},
		name: "TestShop",
		displayName: "Shop",
		tags: ["economy"],
		tests: [
			{ name: "buys", displayName: "buys an item", tags: ["smoke"], cases: [] },
			{ name: "prices", displayName: "prices", tags: [], cases: ["prices (1)", "prices (2)"] },
			{ name: "later", displayName: "later", tags: [], cases: [], skipReason: "not yet" },
		],
	};
}

const tree = () => buildTree([{ modulePath: "ReplicatedStorage.TS.tests.shop.test", plan: shopPlan() }]);
const result = (name: string, passed: boolean, extra: object = {}) => ({
	method: { name },
	label: name,
	passed,
	skipped: false,
	elapsedTimeMs: 2,
	...extra,
});

class TestTree {
	@Test
	public buildsOneRowPerTestAndEachRow() {
		const cls = tree().classes[0];
		Assert.equal(cls.label, "Shop");
		Assert.deepEqual(
			cls.tests.map((t) => t.label),
			["buys an item", "prices (1)", "prices (2)", "later"],
		);
		Assert.equal(cls.tests[2].caseIndex, 1);
		Assert.equal(cls.tests[3].message, "not yet");
		Assert.equal(classStatus(cls), "pending");
	}

	@Test
	public appliesResultsByMethodAndRow() {
		const cls = tree().classes[0];
		applyResults(cls, [
			result("buys", true),
			result("prices", true, { caseIndex: 0 }),
			result("prices", false, { caseIndex: 1, errorMessage: "boom" }),
			result("later", false, { skipped: true, errorMessage: "not yet" }),
		]);
		Assert.deepEqual(
			cls.tests.map((t) => t.status),
			["passed", "passed", "failed", "skipped"],
		);
		Assert.equal(cls.tests[2].message, "boom");
		Assert.equal(cls.tests[0].message, undefined);
		Assert.equal(classStatus(cls), "failed");
	}

	@Test
	public classStatusPrefersPassedOverSkipped() {
		const cls = tree().classes[0];
		applyResults(cls, [result("buys", true)]);
		Assert.equal(classStatus(cls), "passed");
		const skippedOnly = tree().classes[0];
		skippedOnly.tests.forEach((t) => (t.status = "skipped"));
		Assert.equal(classStatus(skippedOnly), "skipped");
	}

	@Test
	public countsEveryRow() {
		const t = tree();
		applyResults(t.classes[0], [result("buys", true), result("prices", false, { caseIndex: 0 })]);
		Assert.deepEqual(countStatuses(t), { passed: 1, failed: 1, skipped: 0, pending: 2 });
	}

	@Test
	public keepsStatusAndExpansionAcrossRefreshes() {
		const old = tree();
		old.classes[0].expanded = false;
		applyResults(old.classes[0], [result("buys", false, { errorMessage: "boom" })]);
		const fresh = keepState(tree(), old);
		Assert.false(fresh.classes[0].expanded);
		Assert.equal(fresh.classes[0].tests[0].status, "failed");
		Assert.equal(fresh.classes[0].tests[0].message, "boom");
		Assert.equal(fresh.classes[0].tests[1].status, "pending");
	}

	@Test
	public searchMatchesWordsAndTags() {
		const t = tree();
		Assert.equal(visible(t, parseQuery("")).size(), 1);
		Assert.deepEqual(
			visible(t, parseQuery("PRICES"))[0].tests.map((x) => x.label),
			["prices (1)", "prices (2)"],
		);
		Assert.deepEqual(
			visible(t, parseQuery("tag:smoke"))[0].tests.map((x) => x.method),
			["buys"],
		);
		Assert.equal(visible(t, parseQuery("tag:economy")).size(), 1, "class tags count");
		Assert.equal(visible(t, parseQuery("shop tag:missing")).size(), 0);
	}

	@Test
	public testNamesAreExactAndUnique() {
		Assert.deepEqual(testNames(visible(tree(), parseQuery("prices"))), ["TestShop.prices"]);
	}

	@Test
	public findsTheModulesOfSelectedTests() {
		const t = buildTree([
			{ modulePath: "RS.shop.test", plan: shopPlan() },
			{ modulePath: "RS.other.test", plan: { ...shopPlan(), name: "TestOther" } },
		]);
		Assert.deepEqual([...modulesFor(t, ["TestShop.buys", "TestShop.prices"])!], ["RS.shop.test"]);
		Assert.equal(modulesFor(t, ["TestMissing.buys"]), undefined);
	}

	@Test
	public mergesAPartialLoadIntoTheFullTree() {
		const other = { ...shopPlan(), name: "TestOther" };
		const full = buildTree([
			{ modulePath: "RS.shop.test", plan: shopPlan() },
			{ modulePath: "RS.other.test", plan: other },
		]);
		applyResults(full.classes[1], [result("buys", false, { errorMessage: "old" })]);
		const partial = buildTree([{ modulePath: "RS.shop.test", plan: shopPlan() }]);
		applyResults(partial.classes[0], [result("buys", true)]);
		const merged = mergePartial(full, partial, new Set(["RS.shop.test"]));
		Assert.deepEqual(
			merged.classes.map((c) => c.name),
			["TestShop", "TestOther"],
		);
		Assert.equal(merged.classes[0].tests[0].status, "passed");
		Assert.equal(merged.classes[1].tests[0].message, "old", "untouched classes keep their results");
	}
}

export = TestTree;
