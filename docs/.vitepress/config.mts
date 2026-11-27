import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
	title: "@rbxts/lunit",
	description: "A TypeScript testing framework for Roblox and Lune",
	base: "/lunit/",
	themeConfig: {
		// https://vitepress.dev/reference/default-theme-config
		nav: [
			{ text: "Home", link: "/" },
			{ text: "Getting Started", link: "/getting-started" },
			{ text: "API", link: "/api-reference" },
			{ text: "Tooling", link: "/tooling" },
		],

		sidebar: [
			{
				text: "Introduction",
				items: [{ text: "Getting Started", link: "/getting-started" }],
			},
			{
				text: "Guides",
				items: [
					{ text: "Writing tests", link: "/guides/writing-tests" },
					{ text: "Decorators", link: "/guides/decorators" },
					{ text: "Running under Lune", link: "/guides/lune" },
					{ text: "Coverage", link: "/guides/coverage" },
				],
			},
			{ text: "API Reference", link: "/api-reference" },
			{ text: "Tooling", link: "/tooling" },
			{ text: "Contributing", link: "/contributing" },
		],

		socialLinks: [{ icon: "github", link: "https://github.com/brandondkong/lunit" }],
	},
});
