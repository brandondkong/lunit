--!nolint LocalShadow
-- Shim that lets Lune run roblox-ts compiled output.
--
-- Package projects: roblox-ts emits `local TS = _G[script]` and
-- `TS.import(script, script.Parent, ...)`. Game projects: it emits
-- `local TS = require(<ReplicatedStorage.rbxts_include.RuntimeLib>)` and
-- `TS.import(script, game:GetService("ReplicatedStorage"), ...)`.
--
-- `game` is a real Lune DataModel. The Rojo project file is turned into real
-- Folder and ModuleScript instances, so `script.Parent`, `IsA` and `typeIs`
-- behave as in Roblox. Each ModuleScript remembers the file it came from.
-- Roblox datatypes and services come from `@lune/roblox`, which ships Roblox's
-- reflection database, so new ones arrive with Lune updates.

local fs = require("@lune/fs")
local luau = require("@lune/luau")
local process = require("@lune/process")
local roblox = require("@lune/roblox")
local serde = require("@lune/serde")
local stdio = require("@lune/stdio")
local task = require("@lune/task")
local Promise = require("./promise")

-- Read by Lunit's `Runtime`: `typeof(game)` is "Instance" here too.
_G.__LUNIT_LUNE = true

local game = roblox.Instance.new("DataModel")
local projectFile = nil -- set once a Rojo project file is loaded

local function projectHint()
	return if projectFile == nil then " (no Rojo project file loaded; pass --project <file>)" else ""
end

local function warn(...)
	local parts = { ... }
	for i, v in ipairs(parts) do
		parts[i] = tostring(v)
	end
	stdio.ewrite(stdio.color("yellow") .. table.concat(parts, "\t") .. stdio.color("reset") .. "\n")
end

-- Globals that every loaded module sees. Datatypes are taken from
-- `@lune/roblox` by name (every capitalized export), not from a fixed list.
local globals = {
	game = game,
	workspace = game:GetService("Workspace"),
	task = task,
	warn = warn,
}
for name, value in roblox do
	if string.match(name, "^%u") then
		globals[name] = value
	end
end

local globalNames = {}
for name in globals do
	table.insert(globalNames, name)
end
table.sort(globalNames)
local globalLocals = {}
for i, name in globalNames do
	globalLocals[i] = `__g.{name}`
end
-- One line, so error line numbers stay off by exactly one.
local PRELUDE = `local script = ...; local __g = _G.__lunitGlobals; local {table.concat(globalNames, ", ")} = {table.concat(
	globalLocals,
	", "
)}; local require = __g.__wrapRequire(require)\n`
_G.__lunitGlobals = globals

--------------------------------------------------------------------------------
-- Stand-ins for engine methods.
--
-- Rule: add a method here only when it has exactly one correct answer in a
-- headless run. Anything else keeps Lune's "X is not a valid member of Y"
-- error; users can fake it for their own game in a setup file.
--------------------------------------------------------------------------------

-- Lune cannot wait for children to appear, so do not hang: return the child,
-- return nil when a timeout was given (as Roblox does), or fail at once.
roblox.implementMethod("Instance", "WaitForChild", function(self, name, timeout)
	local child = self:FindFirstChild(name)
	if child == nil and timeout == nil then
		error(
			`Infinite yield: {self:GetFullName()}.{name} does not exist (Lune does not wait for children){projectHint()}`,
			2
		)
	end
	return child
end)

for _, method in { "IsStudio", "IsClient", "IsServer", "IsRunning", "IsRunMode", "IsEdit" } do
	roblox.implementMethod("RunService", method, function()
		return false
	end)
end

roblox.implementMethod("HttpService", "JSONEncode", function(_, value)
	return serde.encode("json", value)
end)
roblox.implementMethod("HttpService", "JSONDecode", function(_, text)
	return serde.decode("json", text)
end)
roblox.implementMethod("HttpService", "GenerateGUID", function(_, wrapInCurlyBraces)
	local guid = string.gsub("xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx", "[xy]", function(c)
		local v = if c == "x" then math.random(0, 15) else math.random(8, 11)
		return string.format("%X", v)
	end)
	return if wrapInCurlyBraces == false then guid else "{" .. guid .. "}"
end)

--------------------------------------------------------------------------------
-- Paths and the Rojo tree.
--------------------------------------------------------------------------------

local function normalizeFs(path)
	path = string.gsub(path, "\\", "/")
	path = string.gsub(path, "^%./", "")
	path = string.gsub(path, "/+$", "")
	if path == "." then
		return ""
	end
	return path
end

local function join(base, rest)
	if base == "" then
		return rest
	elseif rest == "" then
		return base
	end
	return base .. "/" .. rest
end

local MAX_DEPTH = 64

-- Lune creates a new userdata on every read of an instance, so instances
-- cannot be table keys. `==` works, so roots are kept in a list and each
-- instance gets a string key from its root index and its ancestor names.
local roots = { game }
local fileByKey = {} -- instance key -> source file
local instanceByFs = {} -- filesystem path (no extension) -> instance
local mountedFs = {} -- filesystem roots already turned into instances

local function keyOf(instance)
	local names = {}
	local node = instance
	while node.Parent ~= nil do
		table.insert(names, 1, node.Name)
		node = node.Parent
	end
	for i, root in roots do
		if root == node then
			return `{i}:{table.concat(names, "/")}`
		end
	end
	return nil
end

local function remember(instance, fsPath, file)
	if instanceByFs[fsPath] == nil then
		instanceByFs[fsPath] = instance
	end
	if file ~= nil then
		local key = keyOf(instance)
		if key ~= nil then
			fileByKey[key] = file
		end
	end
end

local function isLuaFile(name)
	return string.match(name, "%.luau?$") ~= nil
end

-- Rojo's file rules: `x.luau` is a ModuleScript, `x.server.luau` a Script,
-- `x.client.luau` a LocalScript. Other files are ignored here.
local function scriptKind(name)
	local base, ext = string.match(name, "^(.-)(%.luau?)$")
	if base == nil then
		return nil
	end
	local server = string.match(base, "^(.*)%.server$")
	if server then
		return "Script", server
	end
	local client = string.match(base, "^(.*)%.client$")
	if client then
		return "LocalScript", client
	end
	return "ModuleScript", base
end

local buildPath

local function initFile(dir)
	for _, name in { "init.luau", "init.lua", "init.server.luau", "init.server.lua", "init.client.luau", "init.client.lua" } do
		if fs.isFile(dir .. "/" .. name) then
			return name
		end
	end
	return nil
end

-- Children of a directory are attached only when they hold Lua code.
local function buildChildren(dir, parent, depth)
	for _, name in fs.readDir(dir) do
		if string.match(name, "^init%.") == nil and name ~= ".git" then
			local child = buildPath(join(dir, name), name, depth + 1)
			if child ~= nil then
				child.Parent = parent
			end
		end
	end
end

-- Builds the instance for one file or directory. Returns nil when there is
-- no Lua code below it.
-- `isMount` is set for a Rojo `$path`: the instance then takes the node's
-- name, not the file's.
function buildPath(path, name, depth, isMount)
	if depth > MAX_DEPTH then
		return nil
	end
	if fs.isFile(path) then
		local className, base = scriptKind(string.match(path, "[^/]+$"))
		if className == nil then
			return nil
		end
		local instance = roblox.Instance.new(className)
		instance.Name = if isMount then name else base
		return instance, path
	end
	if not fs.isDir(path) then
		return nil
	end
	local init = initFile(path)
	local instance
	if init ~= nil then
		instance = roblox.Instance.new((scriptKind(init)))
	else
		instance = roblox.Instance.new("Folder")
	end
	instance.Name = name
	buildChildren(path, instance, depth)
	if init == nil and not isMount and #instance:GetChildren() == 0 then
		return nil
	end
	return instance, if init ~= nil then path .. "/" .. init else nil
end

-- Records file mappings after the subtree is parented, since keys depend on
-- the ancestor chain.
local function indexSubtree(instance, fsPath)
	if fs.isFile(fsPath) then
		if instance:IsA("ModuleScript") then
			remember(instance, (string.gsub(fsPath, "%.luau?$", "")), fsPath)
		end
		return
	end
	local init = initFile(fsPath)
	remember(instance, fsPath, if init ~= nil and instance:IsA("ModuleScript") then fsPath .. "/" .. init else nil)
	for _, name in fs.readDir(fsPath) do
		if string.match(name, "^init%.") == nil then
			local _, base = scriptKind(name)
			local childName = if fs.isFile(join(fsPath, name)) then base else name
			if childName ~= nil then
				local child = instance:FindFirstChild(childName)
				if child ~= nil then
					indexSubtree(child, join(fsPath, name))
				end
			end
		end
	end
end

local function mount(fsPath, name, parent, className)
	fsPath = normalizeFs(fsPath)
	local instance = buildPath(fsPath, name, 0, true)
	if instance == nil then
		local ok, created = pcall(roblox.Instance.new, className or "Folder")
		instance = if ok then created else roblox.Instance.new("Folder")
		instance.Name = name
	end
	if parent ~= nil then
		instance.Parent = parent
	else
		table.insert(roots, instance)
	end
	table.insert(mountedFs, fsPath)
	indexSubtree(instance, fsPath)
	return instance
end

local function buildNode(node, name, parent)
	local instance
	if parent == game then
		local ok, service = pcall(function()
			return game:GetService(name)
		end)
		if ok then
			instance = service
		end
	end
	if type(node["$path"]) == "string" and instance == nil then
		instance = mount(node["$path"], name, parent, node["$className"])
	elseif type(node["$path"]) == "string" then
		-- A service with a $path: its children come from the directory.
		local fsPath = normalizeFs(node["$path"])
		buildChildren(fsPath, instance, 0)
		table.insert(mountedFs, fsPath)
		indexSubtree(instance, fsPath)
	elseif instance == nil then
		local ok, created = pcall(roblox.Instance.new, node["$className"] or "Folder")
		instance = if ok then created else roblox.Instance.new("Folder")
		instance.Name = name
		if parent ~= nil then
			instance.Parent = parent
		else
			table.insert(roots, instance)
		end
	end
	for key, child in node do
		if type(key) == "string" and string.sub(key, 1, 1) ~= "$" and type(child) == "table" then
			buildNode(child, key, instance)
		end
	end
	return instance
end

-- Reads a Rojo project file and builds its tree. Returns false when the file
-- does not exist.
local function loadProject(path)
	if not fs.isFile(path) then
		return false
	end
	local project = serde.decode("json", fs.readFile(path))
	if type(project) ~= "table" or type(project.tree) ~= "table" then
		error(`lunit: {path} is not a Rojo project file (no "tree")`, 2)
	end
	local tree = project.tree
	if tree["$className"] == "DataModel" then
		for key, child in tree do
			if type(key) == "string" and string.sub(key, 1, 1) ~= "$" and type(child) == "table" then
				buildNode(child, key, game)
			end
		end
	else
		buildNode(tree, project.name or "Project", nil)
	end
	projectFile = path
	return true
end

-- Filesystem paths outside the Rojo tree (package projects, or no project
-- file) are mounted on demand as their own root.
local function mountRootFor(fsPath)
	local pkg = string.match(fsPath, "^(node_modules/@[^/]+/[^/]+)")
		or string.match(fsPath, "^(node_modules/[^/]+)")
	if pkg ~= nil then
		return pkg
	end
	return string.match(fsPath, "^([^/]+)") or fsPath
end

local function instanceForFs(fsPath)
	fsPath = normalizeFs((string.gsub(normalizeFs(fsPath), "%.luau?$", "")))
	local found = instanceByFs[fsPath]
	if found ~= nil then
		return found
	end
	local root = mountRootFor(fsPath)
	for _, mounted in mountedFs do
		if mounted == root then
			return nil
		end
	end
	mount(root, string.match(root, "[^/]+$") or root, nil)
	return instanceByFs[fsPath]
end

--------------------------------------------------------------------------------
-- TS runtime helpers and the module loader.
--------------------------------------------------------------------------------

-- Forward-declared so `import` can recurse.
local loadModule

local function describe(instance)
	local ok, name = pcall(function()
		return instance:GetFullName()
	end)
	return if ok then name else tostring(instance)
end

-- Build the TS runtime helpers. Mirrors RuntimeLib.lua but skips Roblox-only
-- paths (the _G[module] guard) and uses our shim's loader for TS.import.
local function buildTS()
	local TS = { Promise = Promise }

	function TS.import(_caller, module, ...)
		local target = module
		for i = 1, select("#", ...) do
			local name = (select(i, ...))
			local child = target:FindFirstChild(name)
			if child == nil then
				error(`module not found: {describe(target)}.{name}{projectHint()}`, 2)
			end
			target = child
		end
		return loadModule(target)
	end

	-- Same lookup as RuntimeLib: the nearest ancestor `node_modules` that has
	-- the package, then the project's own node_modules.
	function TS.getModule(caller, scope, moduleName)
		if moduleName == nil then
			moduleName = scope
			scope = "@rbxts"
		end
		local node = caller.Parent
		while node ~= nil do
			local modules = node:FindFirstChild("node_modules")
			local scopeFolder = modules and modules:FindFirstChild(scope)
			local found = scopeFolder and scopeFolder:FindFirstChild(moduleName)
			if found ~= nil then
				return found
			end
			node = node.Parent
		end
		local fsPath = `node_modules/{scope}/{moduleName}`
		if fs.isDir(fsPath) then
			local found = instanceForFs(fsPath)
			if found ~= nil then
				return found
			end
		end
		error(`Could not find module: {scope}/{moduleName}`, 2)
	end

	function TS.async(callback)
		return function(...)
			local n = select("#", ...)
			local args = { ... }
			return Promise.new(function(resolve, reject)
				coroutine.wrap(function()
					local ok, result = pcall(callback, table.unpack(args, 1, n))
					if ok then
						resolve(result)
					else
						reject(result)
					end
				end)()
			end)
		end
	end

	function TS.await(p)
		if not Promise.is(p) then
			return p
		end
		local status, value = p:awaitStatus()
		if status == Promise.Status.Resolved then
			return value
		elseif status == Promise.Status.Rejected then
			error(value, 2)
		else
			error("The awaited Promise was cancelled", 2)
		end
	end

	function TS.instanceof(obj, class)
		if type(class) == "table" and type(class.instanceof) == "function" then
			return class.instanceof(obj)
		end
		if type(obj) == "table" then
			obj = getmetatable(obj)
			while obj ~= nil do
				if obj == class then
					return true
				end
				local mt = getmetatable(obj)
				obj = mt and mt.__index or nil
			end
		end
		return false
	end

	TS.TRY_RETURN = 1
	TS.TRY_BREAK = 2
	TS.TRY_CONTINUE = 3

	function TS.try(try, catchFn, finallyFn)
		local trySuccess, exitTypeOrTryError, returns = pcall(try)
		local exitType, tryError
		if trySuccess then
			exitType = exitTypeOrTryError
		else
			tryError = exitTypeOrTryError
		end

		local catchSuccess, catchError = true, nil
		if not trySuccess and catchFn then
			local newExitTypeOrCatchError, newReturns
			catchSuccess, newExitTypeOrCatchError, newReturns = pcall(catchFn, tryError)
			local newExitType
			if catchSuccess then
				newExitType = newExitTypeOrCatchError
			else
				catchError = newExitTypeOrCatchError
			end
			if newExitType then
				exitType, returns = newExitType, newReturns
			end
		end

		if finallyFn then
			local newExitType, newReturns = finallyFn()
			if newExitType then
				exitType, returns = newExitType, newReturns
			end
		end

		if exitType ~= TS.TRY_RETURN and exitType ~= TS.TRY_BREAK and exitType ~= TS.TRY_CONTINUE then
			if not catchSuccess then
				error(catchError, 2)
			end
			if not trySuccess and not catchFn then
				error(tryError, 2)
			end
		end

		return exitType, returns
	end

	function TS.bit_lrsh(a, b)
		return bit32.arshift(a, b)
	end


	function TS.generator(callback)
		local co = coroutine.create(callback)
		return {
			next = function(...)
				if coroutine.status(co) == "dead" then
					return { done = true }
				else
					local success, value = coroutine.resume(co, ...)
					if success == false then
						error(value, 2)
					end
					return {
						value = value,
						done = coroutine.status(co) == "dead",
					}
				end
			end,
		}
	end

	return TS
end

local runtimeLib = buildTS()
local cache = {}

-- Wraps the chunk's own `require`. Strings (e.g. "@lune/fs") still go to Lune;
-- instance requires go to our loader, and RuntimeLib maps to the helpers.
globals.__wrapRequire = function(nativeRequire)
	return function(target, ...)
		if type(target) == "string" then
			return nativeRequire(target, ...)
		end
		if typeof(target) == "Instance" then
			if target.Name == "RuntimeLib" then
				return runtimeLib
			end
			return loadModule(target)
		end
		error(`lunit: cannot require a {typeof(target)} under Lune`, 2)
	end
end

function loadModule(instance)
	local key = keyOf(instance)
	local file = if key ~= nil then fileByKey[key] else nil
	if file == nil then
		error(`module not found: {describe(instance)} is not a ModuleScript loaded from a file`, 2)
	end

	local cached = cache[file]
	if cached ~= nil then
		return cached
	end

	-- Provide TS runtime for this module before its chunk runs.
	_G[instance] = buildTS()

	local chunk = luau.load(PRELUDE .. fs.readFile(file), { debugName = file })
	local result = chunk(instance)
	cache[file] = result
	return result
end

-- Path from this file's folder to `target` (relative to the cwd), for Lune's
-- `require`, which only takes `./` and `../` paths.
local function requirePathFromHere(target)
	local here = string.gsub(debug.info(1, "s"), "\\", "/")
	local cwd = string.gsub(string.gsub(process.cwd, "\\", "/"), "/+$", "")
	local absolute = if string.sub(target, 1, 1) == "/" then target else cwd .. "/" .. normalizeFs(target)
	absolute = string.gsub(absolute, "%.luau?$", "")
	local from = string.split(string.match(here, "^(.*)/[^/]*$"), "/")
	local to = string.split(absolute, "/")
	local common = 0
	while common < #from and common < #to and from[common + 1] == to[common + 1] do
		common += 1
	end
	local parts = {}
	for _ = common + 1, #from do
		table.insert(parts, "..")
	end
	for i = common + 1, #to do
		table.insert(parts, to[i])
	end
	local path = table.concat(parts, "/")
	return if string.sub(path, 1, 3) == "../" then path else "./" .. path
end

-- Runs a user setup file before any test module loads. It is a normal Lune
-- module (relative requires work). If it returns a function, that function is
-- called with { game = game }.
local function runSetup(path)
	if not fs.isFile(path) then
		error("setup file not found: " .. path, 2)
	end
	local result = require(requirePathFromHere(path))
	if type(result) == "function" then
		result({ game = game })
	end
end

local shim = {
	loadProject = loadProject,
	runSetup = runSetup,
	game = game,
}

-- Called by the runner after flags are read, so `--project` can replace the
-- default project file.
function shim.useDefaultProject()
	if projectFile == nil then
		loadProject("default.project.json")
	end
end

-- Callable for backwards compatibility: `shim(path)` loads the module at a
-- filesystem path, as before.
return setmetatable(shim, {
	__call = function(_, path)
		if projectFile == nil then
			loadProject("default.project.json")
		end
		local instance = instanceForFs(path)
		if instance == nil then
			error("module not found: " .. path, 2)
		end
		return loadModule(instance)
	end,
})
