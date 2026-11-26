-- Standalone Lunit runner for Luau/Lune projects.
-- Walks `tests-root` for *.test.luau files, registers each as a test class,
-- and runs them through the compiled Lunit at `lunit-root`. Exits non-zero
-- if any test fails so it composes with CI.
--
-- Usage: lune run lunit.luau [tests-root] [lunit-root] [--project <file>] [--setup <file>]
--   tests-root  default: out/test
--   lunit-root  default: node_modules/@rbxts/lunit/out, else the `out` folder
--               next to this script
--   --project   Rojo project file used to resolve game:GetService(...) imports.
--               default: default.project.json
--   --setup     Luau file run before any test loads, for project-specific
--               stand-ins. default: lunit.setup.luau, when it exists

local fs = require("@lune/fs")
local process = require("@lune/process")

local shim = require("./lune-shim")
local reporter = require("./lune-reporter")

local positional = {}
local setupFile = nil
local i = 1
while i <= #process.args do
	local arg = process.args[i]
	if arg == "--project" or arg == "--setup" then
		local path = process.args[i + 1]
		if path == nil then
			error(arg .. " needs a file path")
		end
		if arg == "--setup" then
			setupFile = path
		elseif not shim.loadProject(path) then
			error("project file not found: " .. path)
		end
		i += 2
	else
		table.insert(positional, arg)
		i += 1
	end
end

shim.useDefaultProject()
if setupFile == nil and fs.isFile("lunit.setup.luau") then
	setupFile = "lunit.setup.luau"
end
if setupFile ~= nil then
	shim.runSetup(setupFile)
end

-- The `out` folder of the package that holds this script. Resolves to `out`
-- when Lunit runs its own suite.
local function packageOut()
	local source = string.gsub(debug.info(1, "s"), "\\", "/")
	local root = string.match(source, "^(.*)/scripts/lunit$") or "."
	local cwd = string.gsub(string.gsub(process.cwd, "\\", "/"), "/+$", "")
	if root == cwd then
		return "out"
	elseif string.sub(root, 1, #cwd + 1) == cwd .. "/" then
		root = string.sub(root, #cwd + 2)
	end
	return root .. "/out"
end

local function defaultLunitRoot()
	-- Prefer the path that Rojo mounts, so that the runner and the tests load
	-- the same copy of Lunit.
	local installed = "node_modules/@rbxts/lunit/out"
	if fs.isFile(installed .. "/init.luau") or fs.isFile(installed .. "/init.lua") then
		return installed
	end
	return packageOut()
end

local testsRoot = positional[1] or "out/test"
local lunitRoot = positional[2] or defaultLunitRoot()

local function isTestFile(name)
	return name:match("%.test%.luau?$") ~= nil or name:match("%.spec%.luau?$") ~= nil
end

local function discover(root, found)
	if not fs.isDir(root) then
		return found
	end
	for _, name in fs.readDir(root) do
		local path = root .. "/" .. name
		if fs.isDir(path) then
			discover(path, found)
		elseif isTestFile(name) then
			table.insert(found, (path:gsub("%.luau?$", "")))
		end
	end
	return found
end

local lunit = shim(lunitRoot)

local classes = {}
for _, modulePath in ipairs(discover(testsRoot, {})) do
	local cls = shim(modulePath)
	if cls ~= nil then
		table.insert(classes, cls)
	end
end

if #classes == 0 then
	print("No tests found in " .. testsRoot)
	process.exit(1)
end

local result = lunit.TestRunner:fromClasses(classes):run({ reporter = reporter }):expect()
process.exit(if result.numTestsFailed > 0 then 1 else 0)
