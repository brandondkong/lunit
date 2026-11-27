-- Standalone Lunit runner for Luau/Lune projects.
-- Walks `tests-root` for *.test.luau files, registers each as a test class,
-- and runs them through the compiled Lunit at `lunit-root`. Exits non-zero
-- if any test fails so it composes with CI. Run `lunit --help` for options.

local fs = require("@lune/fs")
local process = require("@lune/process")
local stdio = require("@lune/stdio")

local shim = require("./lune-shim")
local reporter = require("./lune-reporter")

local USAGE = [[
Usage: lunit [tests-root] [lunit-root] [options]

Arguments:
  tests-root              Folder to search for *.test.luau / *.spec.luau files (default: out)
  lunit-root              Compiled Lunit (default: node_modules/@rbxts/lunit/out)

Options:
  --filter <text>         Run only tests whose Class.method or display name contains <text>
  --tag <tag>             Run only tests with this tag (repeat, or separate with commas)
  --exclude-tag <tag>     Leave out tests with this tag (repeat, or separate with commas)
  --bail                  Stop after the first failing test
  --coverage              Print line coverage and write coverage/lcov.info (needs a build
                          made with @rbxts/lunit/transformer)
  --project <file>        Rojo project file (default: default.project.json)
  --setup <file>          Setup file run before tests load (default: lunit.setup.luau, if present)
  -h, --help              Show this help
]]

local function fail(message)
	stdio.ewrite("lunit: " .. message .. "\n\n" .. USAGE)
	process.exit(2)
end

local function splitTags(value, into)
	for _, tag in string.split(value, ",") do
		tag = string.match(tag, "^%s*(.-)%s*$")
		if tag ~= "" then
			table.insert(into, tag)
		end
	end
end

local positional = {}
local runOptions = { reporter = reporter }
local includeTags, excludeTags = {}, {}
local projectFile, setupFile = nil, nil

local VALUE_FLAGS = { ["--filter"] = true, ["--tag"] = true, ["--exclude-tag"] = true, ["--project"] = true, ["--setup"] = true }

local i = 1
while i <= #process.args do
	local arg = process.args[i]
	-- Accept both `--flag value` and `--flag=value`.
	local flag, inline = string.match(arg, "^(%-%-[%w-]+)=(.*)$")
	flag = flag or arg
	if flag == "-h" or flag == "--help" then
		print(USAGE)
		process.exit(0)
	elseif flag == "--bail" then
		runOptions.bail = true
		i += 1
	elseif flag == "--coverage" then
		runOptions.coverage = true
		i += 1
	elseif VALUE_FLAGS[flag] then
		local value = inline
		if value == nil then
			value = process.args[i + 1]
			i += 1
		end
		if value == nil or value == "" then
			fail(flag .. " needs a value")
		end
		if flag == "--filter" then
			runOptions.filter = value
		elseif flag == "--tag" then
			splitTags(value, includeTags)
		elseif flag == "--exclude-tag" then
			splitTags(value, excludeTags)
		elseif flag == "--project" then
			projectFile = value
		else
			setupFile = value
		end
		i += 1
	elseif string.sub(arg, 1, 1) == "-" then
		fail("unknown option " .. arg)
	else
		table.insert(positional, arg)
		i += 1
	end
end

if #includeTags > 0 then
	runOptions.tags = includeTags
end
if #excludeTags > 0 then
	runOptions.excludeTags = excludeTags
end

if projectFile ~= nil and not shim.loadProject(projectFile) then
	fail("project file not found: " .. projectFile)
end
shim.useDefaultProject()
if setupFile == nil and fs.isFile("lunit.setup.luau") then
	setupFile = "lunit.setup.luau"
end
if setupFile ~= nil then
	if not fs.isFile(setupFile) then
		fail("setup file not found: " .. setupFile)
	end
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

local testsRoot = positional[1] or "out"
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

local result = lunit.TestRunner:fromClasses(classes):run(runOptions):expect()
if result.coverage ~= nil then
	if not fs.isDir("coverage") then
		fs.writeDir("coverage")
	end
	fs.writeFile("coverage/lcov.info", lunit.Coverage.toLcov(result.coverage))
	print("Wrote coverage/lcov.info")
elseif runOptions.coverage and fs.isFile("coverage/lcov.info") then
	-- Do not leave an old report that looks like this run's.
	fs.removeFile("coverage/lcov.info")
end
process.exit(if result.numTestsFailed > 0 then 1 else 0)
