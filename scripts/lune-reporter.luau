-- ANSI-coloring output wrapper for Lune. Roblox Output doesn't render ANSI,
-- so this only plugs in via the Lune entry script.

local stdio = require("@lune/stdio")

local function wrap(color, text)
	return stdio.color(color) .. text .. stdio.color("reset")
end

local replacements = {
	{ "PASSED", wrap("green", "PASSED") },
	{ "FAILED", wrap("red", "FAILED") },
	{ "SKIPPED", wrap("yellow", "SKIPPED") },
	{ "✓", wrap("green", "✓") },
	{ "✗", wrap("red", "✗") },
	{ "↓", wrap("yellow", "↓") },
}

local function colorize(text)
	for _, pair in replacements do
		text = string.gsub(text, pair[1], pair[2])
	end
	return text
end

local function output(text)
	stdio.write(colorize(text) .. "\n")
end

return {
	output = output,
}
