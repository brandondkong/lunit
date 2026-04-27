--!nolint LocalShadow
-- Minimal shim that lets Lune run roblox-ts compiled output.
--
-- roblox-ts emits `local TS = _G[script]` and `TS.import(script, fromScript, ...path)`,
-- which expects a Roblox-style `script` Instance and a runtime helper at `_G[script]`.
-- We synthesize both: each module gets a script-like table whose Parent/child
-- indexing maps to filesystem paths, and `_G[scriptObj]` exposes the runtime helpers
-- (import, async, await, try, Promise, etc).

local fs = require("@lune/fs")
local luau = require("@lune/luau")
local task = require("@lune/task")
local stdio = require("@lune/stdio")

-- Fake Heartbeat signal so @rbxts/promise's `Promise._timeEvent` works under Lune.
local heartbeat = {}
do
	local connections = {}
	local running = false

	local function ensureRunning()
		if running then
			return
		end
		running = true
		task.spawn(function()
			while next(connections) do
				task.wait()
				for fn in pairs(connections) do
					task.spawn(fn)
				end
			end
			running = false
		end)
	end

	function heartbeat:Connect(fn)
		connections[fn] = true
		ensureRunning()
		return {
			Disconnect = function()
				connections[fn] = nil
			end,
		}
	end

	function heartbeat:Wait()
		task.wait()
	end
end

-- Minimal `game` stub. Only `game:GetService("RunService").Heartbeat` is exercised at
-- Promise.lua load time; everything else here is defensive.
local runService = { Heartbeat = heartbeat, IsRunning = function() return false end, IsClient = function() return false end, IsStudio = function() return false end }
local game = {}
function game:GetService(name)
	if name == "RunService" then
		return runService
	end
	error("Lune shim: unsupported service " .. tostring(name), 2)
end
_G.game = game
_G.task = task
_G.warn = function(...)
	local parts = { ... }
	for i, v in ipairs(parts) do
		parts[i] = tostring(v)
	end
	stdio.ewrite(stdio.color("yellow") .. table.concat(parts, "\t") .. stdio.color("reset") .. "\n")
end

-- TS.async / TS.await rely on Promise.new and Promise.is. We delegate to whatever
-- Promise instance Promise.lua hands us via `_G[scriptObj].Promise`.

local cache = {}
local scriptByPath = {}

local function makeScript(path)
	local existing = scriptByPath[path]
	if existing then
		return existing
	end
	local self = { __path = path }
	setmetatable(self, {
		__index = function(_, key)
			if key == "Parent" then
				local cut = string.find(path, "/[^/]*$")
				if not cut then
					return nil
				end
				return makeScript(string.sub(path, 1, cut - 1))
			end
			return makeScript(path .. "/" .. tostring(key))
		end,
		__tostring = function()
			return "Script(" .. path .. ")"
		end,
	})
	scriptByPath[path] = self
	return self
end

local function resolveFile(path)
	local asFile = path .. ".luau"
	if fs.isFile(asFile) then
		return asFile
	end
	local asInit = path .. "/init.luau"
	if fs.isFile(asInit) then
		return asInit
	end
	-- Also try the .lua extension (RuntimeLib.lua, Promise.lua live as .lua).
	local asLua = path .. ".lua"
	if fs.isFile(asLua) then
		return asLua
	end
	return nil
end

-- Forward-declared so `import` can recurse.
local loadModule

-- Build the TS runtime helpers. Mirrors RuntimeLib.lua but skips Roblox-only paths
-- (TS.getModule, the _G[module] guard) and uses our shim's loader for TS.import.
local function buildTS(promise)
	local TS = { Promise = promise }

	function TS.import(_caller, module, ...)
		local target = module
		for i = 1, select("#", ...) do
			target = target[(select(i, ...))]
		end
		return loadModule(target)
	end

	function TS.async(callback)
		return function(...)
			local n = select("#", ...)
			local args = { ... }
			return promise.new(function(resolve, reject)
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
		if not promise.is(p) then
			return p
		end
		local status, value = p:awaitStatus()
		if status == promise.Status.Resolved then
			return value
		elseif status == promise.Status.Rejected then
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

-- Bootstrap @rbxts/promise from the roblox-ts include directory.
local PROMISE_PATH = "node_modules/.pnpm/roblox-ts@3.0.0/node_modules/roblox-ts/include/Promise"
local promiseModule

local function getPromise()
	if promiseModule then
		return promiseModule
	end
	local source = "local game, task, warn = _G.game, _G.task, _G.warn\n" .. fs.readFile(PROMISE_PATH .. ".lua")
	local chunk = luau.load(source, { debugName = "Promise" })
	promiseModule = chunk()
	return promiseModule
end

function loadModule(scriptObj)
	local path = scriptObj.__path
	local cached = cache[path]
	if cached ~= nil then
		return cached
	end

	local filePath = resolveFile(path)
	if not filePath then
		error("module not found: " .. path, 2)
	end

	-- Provide TS runtime for this module before its chunk runs.
	_G[scriptObj] = buildTS(getPromise())

	-- Lune's loaded chunks don't inherit globals from the caller, so inject
	-- `script` (per-module) plus the Roblox-flavored globals we've stubbed in _G.
	local source = "local script, game, task, warn = ..., _G.game, _G.task, _G.warn\n" .. fs.readFile(filePath)
	local chunk = luau.load(source, { debugName = path })
	local result = chunk(scriptObj)
	cache[path] = result
	return result
end

local function rbxRequire(path)
	return loadModule(makeScript(path))
end

return rbxRequire
