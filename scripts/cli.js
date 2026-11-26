#!/usr/bin/env node
// The `lunit` command. Runs the Lune test runner that ships next to this file
// and passes every argument through: `lunit out/tests --bail`.
"use strict";

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const runner = path.join(__dirname, "lunit.luau");
const result = spawnSync("lune", ["run", runner, ...process.argv.slice(2)], { stdio: "inherit" });

if (result.error) {
	if (result.error.code === "ENOENT") {
		console.error("lunit: `lune` was not found on PATH. Install it with `rokit add lune-org/lune`.");
		process.exit(127);
	}
	throw result.error;
}
process.exit(result.status ?? 1);
