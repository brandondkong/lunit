// Builds the plugin into Roblox Studio's local Plugins folder.
"use strict";
const { spawnSync } = require("child_process");
const os = require("os");
const path = require("path");
const fs = require("fs");

const dir =
	process.platform === "win32"
		? path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local"), "Roblox", "Plugins")
		: path.join(os.homedir(), "Documents", "Roblox", "Plugins");
fs.mkdirSync(dir, { recursive: true });
const output = path.join(dir, "Lunit.rbxm");
const result = spawnSync("rojo", ["build", "-o", output], { stdio: "inherit", shell: process.platform === "win32" });
if (result.error) {
	console.error("install-plugin: could not run rojo. Install it with `rokit install`.");
	process.exit(1);
}
if (result.status === 0) console.log(`Installed ${output}. Restart Studio, or reload plugins, to load it.`);
process.exit(result.status ?? 1);
