-- Minimal Promise implementation for Lunit's Lune runtime path.
-- Covers only what the framework and TS.async/await require: new, try, resolve,
-- reject, delay, is, Status; awaitStatus, catch, timeout, expect, getStatus.
-- Anything fancier (chaining, cancellation propagation, unhandled-rejection
-- callbacks) lives in @rbxts/promise on the Roblox path and isn't needed here.

local task = require("@lune/task")

local Promise = {}
Promise.__index = Promise

local Status = table.freeze({
	Started = "Started",
	Resolved = "Resolved",
	Rejected = "Rejected",
	Cancelled = "Cancelled",
})
Promise.Status = Status

local isPromise

local function settle(self, status, value)
	if self._status ~= Status.Started then
		return
	end
	self._status = status
	self._value = value
	local waiters = self._waiters
	self._waiters = nil
	for _, co in ipairs(waiters) do
		task.spawn(co, status, value)
	end
end

function Promise.new(executor)
	local self = setmetatable({
		_status = Status.Started,
		_value = nil,
		_waiters = {},
	}, Promise)

	local function resolve(value)
		if isPromise(value) then
			task.spawn(function()
				local s, v = value:awaitStatus()
				settle(self, s, v)
			end)
		else
			settle(self, Status.Resolved, value)
		end
	end
	local function reject(reason)
		settle(self, Status.Rejected, reason)
	end

	local ok, err = pcall(executor, resolve, reject)
	if not ok then
		settle(self, Status.Rejected, err)
	end
	return self
end

function Promise.resolve(value)
	return Promise.new(function(resolve)
		resolve(value)
	end)
end

function Promise.reject(reason)
	return Promise.new(function(_, reject)
		reject(reason)
	end)
end

function Promise.try(callback, ...)
	local args = table.pack(...)
	return Promise.new(function(resolve, reject)
		local ok, result = pcall(callback, table.unpack(args, 1, args.n))
		if ok then
			resolve(result)
		else
			reject(result)
		end
	end)
end

function Promise.delay(seconds)
	return Promise.new(function(resolve)
		task.delay(seconds, resolve, seconds)
	end)
end

function isPromise(value)
	return type(value) == "table" and getmetatable(value) == Promise
end
Promise.is = isPromise

function Promise:awaitStatus()
	if self._status == Status.Started then
		table.insert(self._waiters, coroutine.running())
		return coroutine.yield()
	end
	return self._status, self._value
end

function Promise:getStatus()
	return self._status
end

function Promise:expect()
	local status, value = self:awaitStatus()
	if status == Status.Rejected then
		error(value, 2)
	end
	if status == Status.Cancelled then
		error("Promise cancelled", 2)
	end
	return value
end

function Promise:catch(handler)
	local source = self
	return Promise.new(function(resolve, reject)
		task.spawn(function()
			local status, value = source:awaitStatus()
			if status == Status.Resolved then
				resolve(value)
			elseif status == Status.Rejected then
				local ok, result = pcall(handler, value)
				if ok then
					resolve(result)
				else
					reject(result)
				end
			else
				reject(value)
			end
		end)
	end)
end

function Promise:timeout(seconds)
	local source = self
	return Promise.new(function(resolve, reject)
		local settled = false
		task.spawn(function()
			local status, value = source:awaitStatus()
			if not settled then
				settled = true
				if status == Status.Resolved then
					resolve(value)
				else
					reject(value)
				end
			end
		end)
		task.delay(seconds, function()
			if not settled then
				settled = true
				reject("Timed out")
			end
		end)
	end)
end

return Promise
