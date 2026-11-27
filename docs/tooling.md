---
outline: deep
---

# Tooling

Tools that work with Lunit. Community tools are made and maintained by their
authors, not by the Lunit project.

## Roblox Studio

The [Lunit Studio plugin](/guides/studio-plugin) lists, runs and inspects
your tests in Edit mode, with coverage. It is part of the Lunit repository.

## Editors

### Lunit Test Companion (VS Code)

[Lunit Test Companion](https://marketplace.visualstudio.com/items?itemName=ShaderCloud.vscode-lunit-companion)
by [ShaderCloud](https://github.com/Shadercloud/lunit-vscode-companion) finds
your Lunit tests and shows them in the VS Code **Test Explorer**. You can run
them from the editor in two ways:

- **Lune:** runs the tests headlessly, the same as `npx lunit`.
- **Roblox Studio:** runs the tests in Studio. With its Studio plugin
  installed, it uses the Studio session that you already have open with
  `rojo serve`.

Install it from the Extensions view (search for "Lunit Test Companion"), or
run:

```bash
code --install-extension ShaderCloud.vscode-lunit-companion
```

The extension works with the [runtime tags](/guides/decorators#tag):
`@Tag("Lune")` and `@Tag("Roblox")` (or `@Tag("Studio")`). For setup and
settings, see the
[extension's README](https://github.com/Shadercloud/lunit-vscode-companion#readme).

## Add your tool

Did you make a tool for Lunit? Open a pull request that adds it to this page.
