import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { generateModel } from './tools/generateModel.js';
import { exportModel } from './tools/exportModel.js';
import { generateSfxTool } from './tools/generateSfx.js';
import { importToRoblox } from './tools/importToRoblox.js';
import { state } from './lib/state.js';

const GUIDE = `You write Three.js code that runs headlessly in Node (a sandboxed VM with THREE, scene, and helpers preloaded).
Rules:
- Build meshes with THREE geometry classes and add them to \`scene\`. Do NOT use THREE.Scene() yourself, do not render, do not import anything.
- Available: all of THREE, plus helpers: makeMaterial({color,metalness,roughness,texture,doubleSided}), displace(geo, amount, freq, seed) for organic/noise deformation (rocks, terrain), noise3(x,y,z), mergeGeometries([...]), rand(), randRange(a,b).
- texture (only if withTextures=true): {type:'noise'|'checker'|'grid'|'stripes'|'dots'|'gradient'|'brick'|'wood'|'marble', colors:['#hex',...], scale:4-20}.
- Scale roughly to real-world meters (a rock ≈ 1-3 units, a house ≈ 8-10 units). Center the model near origin.
- For rocks/organic shapes: create a base geometry (IcosahedronGeometry(r, 3-5), SphereGeometry, BoxGeometry with segments), then apply displace().
- Keep triangle count reasonable (< 100k). Name your meshes.
Example (rock):
  const geo = new THREE.IcosahedronGeometry(1.5, 4);
  displace(geo, 0.55, 1.8, 7);
  const mesh = new THREE.Mesh(geo, makeMaterial({ color:'#6b6b6b', roughness:0.95, texture:{type:'noise', colors:['#7a7a72','#4a4a44'], scale:6} }));
  mesh.name = 'Rock';
  scene.add(mesh);`;

export async function startMcp() {
  const server = new McpServer({ name: 'rotools', version: '1.0.0' });

  server.registerTool(
    'generate_model',
    {
      title: 'Generate 3D Model',
      description: `Generate a 3D model from Three.js code. The code runs headlessly, the result is exported to GLB/OBJ and shown to the user in the local frontend (http://localhost:7890) for Accept/Reject/Regenerate.\n\n${GUIDE}`,
      inputSchema: {
        name: z.string().describe('Short model name, e.g. "Mossy Rock"'),
        description: z.string().optional().describe('What the model is'),
        code: z.string().describe('Three.js code that adds meshes to `scene`'),
        withTextures: z.boolean().optional().default(false).describe('Generate procedural textures'),
      },
    },
    async ({ name, description, code, withTextures }) => {
      const r = await generateModel({ name, description, code, withTextures });
      return { content: [{ type: 'text', text: r.resultText }], isError: false };
    }
  );

  server.registerTool(
    'export_model',
    {
      title: 'Export Model',
      description: 'Export the latest generated model to GLB/GLTF/OBJ files in the exports/ directory.',
      inputSchema: {
        format: z.enum(['glb', 'gltf', 'obj']).optional().describe('Export format'),
        modelId: z.string().optional().describe('Specific model id (default: latest pending/accepted)'),
      },
    },
    async ({ format, modelId }) => {
      const r = await exportModel({ format, modelId });
      return { content: [{ type: 'text', text: `Exported as ${r.format}: ${r.files.join(', ')}` }], isError: false };
    }
  );

  server.registerTool(
    'generate_sfx',
    {
      title: 'Generate SFX / Music',
      description:
        'Generate audio from a text prompt. kind="sfx": sound effects via ElevenLabs (or configured provider). kind="voice": stylized spoken lines / character voice via Google Gemini TTS. kind="music": actual music tracks (instrumentals, songs with vocals) via Google Lyria. The file is saved and playable in the local frontend.',
      inputSchema: {
        prompt: z
          .string()
          .describe(
            'Description of the audio. For sfx: "deep cinematic explosion with debris". For voice: "An old wizard says cheerfully: Welcome, traveler!". For music: "Upbeat chiptune boss battle theme, fast tempo"'
          ),
        kind: z.enum(['sfx', 'voice', 'music']).optional().default('sfx').describe('Type of audio to generate'),
        duration: z.number().optional().describe('Duration in seconds (sfx only, 0.5-22)'),
        name: z.string().optional().describe('Short file name'),
      },
    },
    async ({ prompt, duration, name, kind }) => {
      const r = await generateSfxTool({ prompt, duration, name, kind: kind || 'sfx' });
      return { content: [{ type: 'text', text: r.resultText }], isError: false };
    }
  );

  server.registerTool(
    'import_to_roblox',
    {
      title: 'Import to Roblox Studio',
      description:
        'Send the generated model to Roblox Studio via the local plugin. Requires Roblox Studio open with the RoTools plugin installed. The model is rebuilt as MeshParts in Workspace. Default: imports the current pending model.',
      inputSchema: {
        modelId: z.string().optional().describe('Model id to import (default: current pending model)'),
        name: z.string().optional().describe('Name for the model in Workspace'),
      },
    },
    async ({ modelId, name }) => {
      const r = await importToRoblox({ modelId, name });
      return { content: [{ type: 'text', text: r.resultText }], isError: !r.ok };
    }
  );

  server.registerTool(
    'get_status',
    {
      title: 'Get RoTools Status',
      description: 'Check server status: whether the user has accepted/rejected the pending model, whether Roblox Studio plugin is connected, and recent activity.',
      inputSchema: {},
    },
    async () => {
      const p = state.pendingModel;
      const text = [
        `Roblox Studio plugin: ${state.roblox.online ? `connected (${state.roblox.studioVersion || 'unknown version'})` : 'NOT connected'}`,
        `Pending model: ${p ? `${p.name} (${p.id}) — status: ${p.status}` : 'none'}`,
        `Accepted assets: ${state.assets.length}`,
        `SFX generated: ${state.sfx.length}`,
        `Recent activity:`,
        ...state.activity.slice(-5).map((a) => `  [${a.level}] ${a.message}`),
      ].join('\n');
      return { content: [{ type: 'text', text }], isError: false };
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('RoTools MCP server connected (stdio)');
}
