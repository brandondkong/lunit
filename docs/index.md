---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
    name: "@rbxts/lunit"
    text: "A TypeScript testing framework for Roblox and Lune"
    tagline: "Same tests, two runtimes — fast Lune feedback locally, Studio for integration."
    actions:
        - theme: brand
          text: Get Started
          link: /getting-started
        - theme: alt
          text: API Reference
          link: /api-reference

features:
    - title: Decorator-driven
      details: "@Test, @BeforeEach, @Each, @Retry, @Only, @Tag — declarative test definitions with no setup boilerplate."
    - title: Roblox + Lune
      details: The same *.test.ts files run in Studio against a live DataModel and outside Roblox under Lune for CI. Gate runtime-specific cases with @Skip + Runtime.
    - title: Batteries included
      details: Path-annotated deepEqual diffs, parameterized tests, retry/repeat for flake handling, custom reporters, tag filtering, focus mode.
---
