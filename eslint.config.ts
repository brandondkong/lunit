import roblox from "eslint-plugin-roblox-ts";
import typescript from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";
import prettierRecommended from "eslint-plugin-prettier/recommended";

export default defineConfig([
	globalIgnores(["out/", "docs/", "test/", "scripts/"]),
	prettierRecommended,
	roblox.parser,
	{
		extends: [roblox.configs.recommended, ...typescript.configs.recommendedTypeChecked],
		files: ["lunit/**/*.ts", "lunit/**/*.tsx"],
		rules: {
			"@typescript-eslint/only-throw-error": "off",
			// roblox-ts uses require() to dynamically load ModuleScripts at runtime;
			// there's no ESM equivalent.
			"@typescript-eslint/no-require-imports": "off",
			"prettier/prettier": "warn",
		},
	},
	{
		// Tests intentionally pass non-Error reject reasons (strings) to drive
		// Assert.rejects, and the Lua truthiness checks are deliberate.
		files: ["lunit/test/**/*.ts"],
		rules: {
			"@typescript-eslint/prefer-promise-reject-errors": "off",
			"roblox-ts/lua-truthiness": "off",
		},
	},
]);
