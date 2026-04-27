local rbxRequire = require("./lune-shim")

local lunit = rbxRequire("out")
local TestAssert = rbxRequire("out/test/assert.test")

local runner = lunit.TestRunner:fromClasses({ TestAssert })
runner:run():expect()
