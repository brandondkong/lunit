local rbxRequire = require("./lune-shim")
local reporter = require("./lune-reporter")

local lunit = rbxRequire("out")
local TestAssert = rbxRequire("out/test/assert.test")

local runner = lunit.TestRunner:fromClasses({ TestAssert })
runner:run({ reporter = reporter }):expect()
