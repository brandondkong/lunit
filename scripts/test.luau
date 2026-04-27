local rbxRequire = require("./lune-shim")
local reporter = require("./lune-reporter")

local lunit = rbxRequire("out")
local TestAssert = rbxRequire("out/test/assert.test")
local TestDecorators = rbxRequire("out/test/decorator.test")
local TestRunnerApi = rbxRequire("out/test/runner.test")

local runner = lunit.TestRunner:fromClasses({ TestAssert, TestDecorators, TestRunnerApi })
runner:run({ reporter = reporter }):expect()
