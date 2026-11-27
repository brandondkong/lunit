// Prints an lcov file as a Markdown table, for $GITHUB_STEP_SUMMARY.
// When $GITHUB_OUTPUT is set, also writes the `coverage` output (the line
// coverage as a percentage, e.g. `91.5`).
"use strict";
const fs = require("fs");

const file = process.argv[2] ?? "coverage/lcov.info";
const rows = [];
let hit = 0;
let found = 0;
for (const record of fs.readFileSync(file, "utf8").split("end_of_record")) {
	const name = record.match(/^SF:(.+)$/m);
	if (!name) continue;
	const lh = Number(record.match(/^LH:(\d+)$/m)[1]);
	const lf = Number(record.match(/^LF:(\d+)$/m)[1]);
	hit += lh;
	found += lf;
	rows.push(`| \`${name[1]}\` | ${percent(lh, lf)}% | ${lh}/${lf} |`);
}

function percent(h, f) {
	return (f > 0 ? (h / f) * 100 : 100).toFixed(1);
}

console.log(`### Coverage: ${percent(hit, found)}% (${hit}/${found} lines)\n`);
console.log("| File | Lines | Hit |\n| --- | ---: | ---: |");
console.log(rows.join("\n"));

if (process.env.GITHUB_OUTPUT) {
	fs.appendFileSync(process.env.GITHUB_OUTPUT, `coverage=${percent(hit, found)}\n`);
}
