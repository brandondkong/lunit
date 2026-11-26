-- Runs before any test loads (see the Lune guide). Project-specific stand-ins
-- go here. The Lune runner finds this file by its name.
local roblox = require("@lune/roblox")

return function(ctx)
	local folder = roblox.Instance.new("Folder")
	folder.Name = "FromSetup"
	folder:SetAttribute("count", 1)
	folder.Parent = ctx.game:GetService("Workspace")
end
