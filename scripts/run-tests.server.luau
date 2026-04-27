-- Roblox-side entry that runs Lunit's own test suite under Studio.
-- Place via the bundled default.project.json: rojo build → open in Studio → press Play.
-- Discovers test ModuleScripts (matching the default *.test glob) under out/test
-- and runs them through the Roblox path of the runner.

local lunitFolder = (script.Parent :: Instance):WaitForChild("lunit")
local testRoot = lunitFolder:WaitForChild("test")

local lunit = require(lunitFolder) :: any

local runner = lunit.TestRunner.new({ testRoot })
runner:run():expect()
