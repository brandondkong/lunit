// Compares coverage/lcov.info with the `// hit` and `// miss` markers in
// src/shared/coverage/shop.ts. Exits 1 on any difference.
"use strict";
const fs = require("fs");

const FILE = "src/shared/coverage/shop.ts";

const expected = new Map();
fs.readFileSync(FILE, "utf8")
	.split("\n")
	.forEach((text, i) => {
		const marker = text.match(/\/\/ (hit|miss)$/);
		if (marker) expected.set(i + 1, marker[1]);
	});

if (!fs.existsSync("coverage/lcov.info")) {
	console.error("check-coverage: coverage/lcov.info is missing. Did the build use tsconfig.coverage.json?");
	process.exit(1);
}
const records = fs.readFileSync("coverage/lcov.info", "utf8").split("end_of_record");
const record = records.find((r) => r.includes(`SF:${FILE}\n`));
if (!record) {
	console.error(`check-coverage: no record for ${FILE}`);
	process.exit(1);
}
if (records.some((r) => /SF:.*\.(test|spec)\.ts/.test(r))) {
	console.error("check-coverage: test files must not be instrumented");
	process.exit(1);
}

const actual = new Map();
for (const [, line, count] of record.matchAll(/^DA:(\d+),(\d+)$/gm)) {
	actual.set(Number(line), Number(count) > 0 ? "hit" : "miss");
}

const problems = [];
for (const line of new Set([...expected.keys(), ...actual.keys()])) {
	const want = expected.get(line) ?? "(not counted)";
	const got = actual.get(line) ?? "(not counted)";
	if (want !== got) problems.push(`  line ${line}: expected ${want}, got ${got}`);
}
if (problems.length > 0) {
	console.error(`check-coverage: ${FILE} does not match its markers:\n${problems.sort().join("\n")}`);
	process.exit(1);
}
console.log(`check-coverage: ${expected.size} lines match`);
