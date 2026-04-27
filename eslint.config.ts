import roblox from "eslint-plugin-roblox-ts";
import typescript from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";
import prettierRecommended from "eslint-plugin-prettier/recommended";

export default defineConfig([
	globalIgnores(["out/"]),
	prettierRecommended,
	roblox.parser,
	{
		ignores: ["docs/"],
		extends: [roblox.configs.recommended, ...typescript.configs.recommendedTypeChecked],
		files: ["src/**/*.ts", "src/**/*.tsx"],
		rules: {
			"@typescript-eslint/only-throw-error": "off",
			"prettier/prettier": "warn",
		},
	},
]);
