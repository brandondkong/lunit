--!nolint LocalShadow
-- Minimal shim that lets Lune run roblox-ts compiled output.
--
-- Package projects: roblox-ts emits `local TS = _G[script]` and
-- `TS.import(script, script.Parent, ...)`. Game projects: it emits
-- `local TS = require(<ReplicatedStorage.rbxts_include.RuntimeLib>)` and
-- `TS.import(script, game:GetService("ReplicatedStorage"), ...)`.
-- We synthesize both: each module gets a script-like table whose Parent/child
-- indexing maps to paths, `game` resolves instance paths through the Rojo
-- project file, and the TS runtime helpers come from `_G[script]` or from a
-- RuntimeLib require.

local fs = require("@lune/fs")
local luau = require("@lune/luau")
local serde = require("@lune/serde")
local task = require("@lune/task")
local stdio = require("@lune/stdio")
local Promise = require("./promise")

_G.task = task
_G.warn = function(...)
	local parts = { ... }
	for i, v in ipairs(parts) do
		parts[i] = tostring(v)
	end
	stdio.ewrite(stdio.color("yellow") .. table.concat(parts, "\t") .. stdio.color("reset") .. "\n")
end

-- A node is a script-like table. Its `__path` is either a filesystem path
-- relative to the cwd (package projects) or an instance path under GAME_ROOT
-- (game projects). The Rojo project file maps instance paths to the filesystem.
local GAME_ROOT = "@game"

local cache = {}
local nodeByPath = {}

-- One entry per Rojo `$path`: { instance = "ReplicatedStorage/TS", fs = "out/shared" }
local mountsByInstance = {}
local mountsByFs = {}
local projectFile = nil

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

-- Returns the part of `path` below `base`, or nil when `path` is not under `base`.
local function under(path, base)
	if base == "" then
		return path
	elseif path == base then
		return ""
	elseif string.sub(path, 1, #base + 1) == base .. "/" then
		return string.sub(path, #base + 2)
	end
	return nil
end

local function collectMounts(node, instancePath)
	for key, child in node do
		if type(key) == "string" and string.sub(key, 1, 1) ~= "$" and type(child) == "table" then
			local childPath = join(instancePath, key)
			if type(child["$path"]) == "string" then
				local mount = { instance = childPath, fs = normalizeFs(child["$path"]) }
				table.insert(mountsByInstance, mount)
				table.insert(mountsByFs, mount)
			end
			collectMounts(child, childPath)
		end
	end
end

-- Reads a Rojo project file so that `game:GetService(...)` paths resolve to
-- files. Returns false when the file does not exist.
local function loadProject(path)
	mountsByInstance = {}
	mountsByFs = {}
	projectFile = nil
	if not fs.isFile(path) then
		return false
	end
	local project = serde.decode("json", fs.readFile(path))
	if type(project) ~= "table" or type(project.tree) ~= "table" then
		error(`lunit: {path} is not a Rojo project file (no "tree")`, 2)
	end
	collectMounts(project.tree, "")
	-- Longest match first, so nested mounts win over their parents.
	table.sort(mountsByInstance, function(a, b)
		return #a.instance > #b.instance
	end)
	table.sort(mountsByFs, function(a, b)
		return #a.fs > #b.fs
	end)
	projectFile = path
	return true
end

-- Instance path or filesystem path -> filesystem path. Nil when no mount covers it.
local function toFs(path)
	local inst = under(path, GAME_ROOT)
	if inst == nil then
		return path
	end
	for _, mount in mountsByInstance do
		local rest = under(inst, mount.instance)
		if rest ~= nil then
			return join(mount.fs, rest)
		end
	end
	return nil
end

-- Filesystem path -> instance path when a mount covers it, so that a test
-- file and its game-absolute imports share one module cache.
local function toVirtual(path)
	path = normalizeFs(path)
	for _, mount in mountsByFs do
		local rest = under(path, mount.fs)
		if rest ~= nil then
			return join(GAME_ROOT .. "/" .. mount.instance, rest)
		end
	end
	return path
end

local function resolveFile(path)
	if string.match(path, "%.luau?$") and fs.isFile(path) then
		return path
	end
	for _, suffix in { ".luau", ".lua", "/init.luau", "/init.lua" } do
		local candidate = path .. suffix
		if fs.isFile(candidate) then
			return candidate
		end
	end
	return nil
end

local function exists(path)
	local fsPath = toFs(path)
	if fsPath ~= nil and (fs.isDir(fsPath) or resolveFile(fsPath) ~= nil) then
		return true
	end
	-- Rojo folders without a `$path` (e.g. rbxts_include/node_modules) exist
	-- only because a mount sits below them.
	local inst = under(path, GAME_ROOT)
	if inst ~= nil then
		for _, mount in mountsByInstance do
			if under(mount.instance, inst) ~= nil then
				return true
			end
		end
	end
	return false
end

local function makeNode(path)
	local existing = nodeByPath[path]
	if existing then
		return existing
	end
	local self = { __path = path }
	setmetatable(self, {
		__index = function(_, key)
			if key == "Parent" then
				if path == GAME_ROOT then
					return nil
				end
				local cut = string.find(path, "/[^/]*$")
				if not cut then
					return nil
				end
				return makeNode(string.sub(path, 1, cut - 1))
			elseif key == "Name" then
				if path == GAME_ROOT then
					return "Game"
				end
				return string.match(path, "[^/]+$")
			elseif key == "WaitForChild" then
				return function(_, name)
					return makeNode(join(path, name))
				end
			elseif key == "FindFirstChild" then
				return function(_, name)
					local child = join(path, name)
					return if exists(child) then makeNode(child) else nil
				end
			elseif key == "GetService" and path == GAME_ROOT then
				return function(_, name)
					return makeNode(join(path, name))
				end
			end
			return makeNode(join(path, tostring(key)))
		end,
		__tostring = function()
			return "Script(" .. path .. ")"
		end,
	})
	nodeByPath[path] = self
	return self
end

-- `typeof(game)` stays "table", so `Runtime.isRoblox()` keeps returning false.
_G.game = makeNode(GAME_ROOT)

-- Forward-declared so `import` can recurse.
local loadModule

-- Build the TS runtime helpers. Mirrors RuntimeLib.lua but skips Roblox-only
-- paths (the _G[module] guard) and uses our shim's loader for TS.import.
local function buildTS()
	local TS = { Promise = Promise }

	function TS.import(_caller, module, ...)
		local target = module
		for i = 1, select("#", ...) do
			target = target[(select(i, ...))]
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
		local rest = `node_modules/{scope}/{moduleName}`
		local node = caller.Parent
		while node ~= nil do
			local candidate = join(node.__path, rest)
			if exists(candidate) then
				return makeNode(candidate)
			end
			node = node.Parent
		end
		if fs.isDir(rest) then
			return makeNode(toVirtual(rest))
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

	return TS
end

local runtimeLib = buildTS()

-- Wraps the chunk's own `require`. Strings (e.g. "@lune/fs") still go to Lune;
-- instance-style requires go to our loader, and RuntimeLib maps to the helpers.
_G.__lunitWrapRequire = function(nativeRequire)
	return function(target, ...)
		if type(target) == "string" then
			return nativeRequire(target, ...)
		end
		if type(target) == "table" and rawget(target, "__path") ~= nil then
			if target.Name == "RuntimeLib" then
				return runtimeLib
			end
			return loadModule(target)
		end
		error(`lunit: cannot require a {typeof(target)} under Lune`, 2)
	end
end

function loadModule(scriptObj)
	local path = scriptObj.__path
	local fsPath = toFs(path)
	local filePath = if fsPath ~= nil then resolveFile(fsPath) else nil
	if not filePath then
		local hint = ""
		if fsPath == nil then
			hint = if projectFile ~= nil
				then ` (no $path in {projectFile} covers this instance)`
				else " (no Rojo project file loaded; pass --project <file>)"
		end
		error("module not found: " .. path .. hint, 2)
	end

	local cached = cache[filePath]
	if cached ~= nil then
		return cached
	end

	-- Provide TS runtime for this module before its chunk runs.
	_G[scriptObj] = buildTS()

	-- Lune's loaded chunks don't inherit globals from the caller, so inject
	-- `script` (per-module) plus the Roblox-flavored globals we've stubbed in _G.
	local source = "local script, task, warn, game = ..., _G.task, _G.warn, _G.game; local require = _G.__lunitWrapRequire(require)\n"
		.. fs.readFile(filePath)
	local chunk = luau.load(source, { debugName = path })
	local result = chunk(scriptObj)
	cache[filePath] = result
	return result
end

loadProject("default.project.json")

-- Callable for backwards compatibility: `shim(path)` loads the module at a
-- filesystem path, as before.
return setmetatable({
	loadProject = loadProject,
	toVirtual = toVirtual,
}, {
	__call = function(_, path)
		return loadModule(makeNode(toVirtual(path)))
	end,
})
