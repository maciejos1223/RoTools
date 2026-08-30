--[[
	RoTools — Roblox MCP Plugin
	===========================
	Connects Roblox Studio to the RoTools MCP server (http://localhost:7890).

	What it does:
	  - Polls the server every ~1.5s for queued mesh imports
	  - Rebuilds each imported mesh as EditableMesh -> MeshPart inside Workspace
	  - Reports the result back to the server (visible in the frontend)

	Install:
	  1. Copy this file to your Roblox Plugins folder:
	     %LOCALAPPDATA%\Roblox\Plugins\RobloxMCPPlugin.lua
	  2. Restart Roblox Studio.
	  3. Enable Beta features if requested (File > Beta Features > "EditableMesh" / dynamic generation),
	     and allow HTTP requests if Studio asks (Game Settings > Security > Allow HTTP Requests).
	  4. Use the "RoTools" toolbar button to enable/disable the connection.
]]

local HttpService = game:GetService("HttpService")
local AssetService = game:GetService("AssetService")
local Workspace = game:GetService("Workspace")

local SERVER_URL = "http://localhost:7890"
local POLL_INTERVAL = 1.5
local MAX_VERTS_PER_OBJECT = 20000

local toolbar = plugin:CreateToolbar("RoTools MCP")
local toggleBtn = toolbar:CreateButton(
	"RoTools",
	"Toggle connection to the RoTools MCP server (localhost:7890)",
	"rbxasset://textures/Animation/Edit Animations.png"
)

local running = false
local processing = false

local function log(msg, level)
	local prefix = "[RoTools]"
	if level == "warn" then
		warn(prefix .. " " .. msg)
	else
		print(prefix .. " " .. msg)
	end
end

local function ensureHttp()
	if not HttpService.HttpEnabled then
		local ok, err = pcall(function()
			HttpService.HttpEnabled = true
		end)
		if not ok then
			log("Could not enable HttpService automatically: " .. tostring(err), "warn")
			log("Enable it manually: Game Settings > Security > Allow HTTP Requests", "warn")
			return false
		end
	end
	return true
end

local function buildMesh(objectData)
	local positions = objectData.positions
	local indices = objectData.indices
	local vertCount = #positions / 3
	if vertCount < 3 then
		error("object has fewer than 3 vertices")
	end
	if vertCount > MAX_VERTS_PER_OBJECT then
		error(string.format("object too dense (%d verts, limit %d) — lower triangle count", vertCount, MAX_VERTS_PER_OBJECT))
	end

	local em = AssetService:CreateEditableMesh()

	local vertexIds = table.create(vertCount)
	for i = 1, vertCount do
		local base = (i - 1) * 3
		vertexIds[i] = em:AddVertex(Vector3.new(positions[base + 1], positions[base + 2], positions[base + 3]))
	end

	for i = 1, #indices, 3 do
		pcall(function()
			em:AddFace({ vertexIds[indices[i] + 1], vertexIds[indices[i + 1] + 1], vertexIds[indices[i + 2] + 1] })
		end)
	end

	local color = objectData.color or { 0.65, 0.65, 0.65 }
	local part = AssetService:CreateMeshPartAsync(Content.fromObject(em), {})
	part.Color = Color3.new(color[1], color[2], color[3])
	part.Material = Enum.Material.SmoothPlastic
	part.Anchored = true
	part.CastShadow = true
	part.Name = objectData.name or "Mesh"

	return part
end

local function processJob(jobId, payload)
	local started = os.clock()
	local decoded = HttpService:JSONDecode(payload)

	local model = Instance.new("Model")
	model.Name = decoded.name or "RoToolsImport"

	local built = 0
	for _, objectData in ipairs(decoded.objects or {}) do
		local ok, result = pcall(buildMesh, objectData)
		if ok and result then
			result.Parent = model
			built += 1
		else
			log(("Failed to build object '%s': %s"):format(tostring(objectData.name), tostring(result)), "warn")
		end
	end

	model.Parent = Workspace
	log(("Imported '%s' (%d part(s)) in %.1fs"):format(model.Name, built, os.clock() - started))

	local okPost, err = pcall(function()
		HttpService:PostAsync(
			SERVER_URL .. "/roblox/result",
			HttpService:JSONEncode({
				jobId = jobId,
				ok = built > 0,
				assetName = model.Name,
				parts = built,
				error = built == 0 and "all objects failed to build" or nil,
			})
		)
	end)
	if not okPost then
		log("Failed to report result: " .. tostring(err), "warn")
	end
end

local function pollLoop()
	while running do
		if not processing then
			local ok, err = pcall(function()
				local res = HttpService:GetAsync(SERVER_URL .. "/roblox/next?version=studio-" .. version())
				local data = HttpService:JSONDecode(res)
				if data.jobId and data.payload then
					processing = true
					local okBuild, buildErr = pcall(processJob, data.jobId, data.payload)
					if not okBuild then
						log("Import failed: " .. tostring(buildErr), "warn")
						pcall(function()
							HttpService:PostAsync(
								SERVER_URL .. "/roblox/result",
								HttpService:JSONEncode({ jobId = data.jobId, ok = false, error = tostring(buildErr) })
							)
						end)
					end
					processing = false
				end
			end)
			if not ok then
				log("Server unreachable (" .. tostring(err) .. ") — retrying...", "warn")
			end
		end
		task.wait(POLL_INTERVAL)
	end
	log("Disconnected.", "info")
end

function version()
	return "0.1"
end

toggleBtn.Click:Connect(function()
	running = not running
	toggleBtn:SetActive(running)
	if running then
		if ensureHttp() then
			log("Connecting to " .. SERVER_URL .. " ...", "info")
			task.spawn(pollLoop)
		else
			running = false
			toggleBtn:SetActive(false)
		end
	end
end)

-- auto-start
if ensureHttp() then
	running = true
	toggleBtn:SetActive(true)
	task.spawn(pollLoop)
	log("Auto-started — polling " .. SERVER_URL, "info")
end
