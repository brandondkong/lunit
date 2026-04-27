import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
	title: "@rbxts/lunit",
	description: "A robust TypeScript testing library for Roblox-TS projects",
	base: "/lunit/",
	themeConfig: {
		// https://vitepress.dev/reference/default-theme-config
		nav: [
			{ text: "Home", link: "/" },
			{ text: "Examples", link: "/markdown-examples" },
		],

		sidebar: [
			{
				text: "Introduction",
				items: [{ text: "Getting Started", link: "/getting-started" }],
			},
			{
				text: "Guides",
				items: [
					{ text: "Decorators", link: "/guides/decorators" },
					{ text: "Assertions", link: "/guides/assertions" },
					{ text: "Test Suites", link: "/guides/test-suites" },
					{ text: "Test Runners", link: "/guides/test-runners" },
				],
			},

			{
				text: "Creating and Running Tests",
				items: [
					{ text: "Creating Tests", link: "/creating-tests" },
					{ text: "Test Suites", link: "/creating-tests/test-suites" },
				],
			},

			{ text: "API Reference", link: "/api-reference" },
			{ text: "Contributing", link: "/contributing" },
		],

		socialLinks: [{ icon: "github", link: "https://github.com/brandon-kong/lunit" }],
	},
});
