import { renderTexturePNG } from './textures.js';

const FLOAT = 5126;
const UINT = 5125;
const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;

function pad4(buf, byte) {
  const rem = buf.length % 4;
  if (!rem) return buf;
  return Buffer.concat([buf, Buffer.alloc(4 - rem, byte)]);
}

/**
 * Build a binary .glb from a normalized model.
 * model.objects[] = { name, positions, normals, uvs, indices, material }
 * material = { color:[r,g,b], metalness, roughness, textureSpec|null }
 */
export function buildGLB(model, { textures = true, textureSize = 256 } = {}) {
  const json = {
    asset: { version: '2.0', generator: 'RoTools MCP Generator' },
    scene: 0,
    scenes: [{ nodes: [] }],
    nodes: [],
    meshes: [],
    materials: [],
    accessors: [],
    bufferViews: [],
    buffers: [],
  };

  const bins = [];
  let offset = 0;
  const addView = (data, target) => {
    bins.push(data);
    const view = { buffer: 0, byteOffset: offset, byteLength: data.length };
    if (target) view.target = target;
    json.bufferViews.push(view);
    offset += data.length;
    return json.bufferViews.length - 1;
  };

  // ---- materials / textures ----
  const texCache = new Map();
  const materialIndex = new Map();
  const getMaterialIdx = (mat) => {
    const key = JSON.stringify({
      c: mat.color, m: mat.metalness, r: mat.roughness,
      t: textures && mat.textureSpec ? mat.textureSpec : null,
    });
    if (materialIndex.has(key)) return materialIndex.get(key);
    const pbr = {
      baseColorFactor: [...mat.color, 1],
      metallicFactor: mat.metalness ?? 0.1,
      roughnessFactor: mat.roughness ?? 0.85,
    };
    const m = { name: mat.name || 'mat', pbrMetallicRoughness: pbr, doubleSided: !!mat.doubleSided };
    if (textures && mat.textureSpec) {
      const tkey = JSON.stringify(mat.textureSpec);
      if (!texCache.has(tkey)) {
        const png = renderTexturePNG(mat.textureSpec, textureSize);
        const view = addView(png);
        json.images = json.images || [];
        json.images.push({ bufferView: view, mimeType: 'image/png' });
        json.samplers = json.samplers || [];
        if (!json.samplers.length) json.samplers.push({ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 });
        json.textures = json.textures || [];
        json.textures.push({ sampler: 0, source: json.images.length - 1 });
        texCache.set(tkey, json.textures.length - 1);
      }
      pbr.baseColorTexture = { index: texCache.get(tkey) };
    }
    json.materials.push(m);
    materialIndex.set(key, json.materials.length - 1);
    return materialIndex.get(key);
  };

  // pre-pass: materials first so images land early (order irrelevant, just tidy)
  for (const obj of model.objects) getMaterialIdx(obj.material);

  // ---- geometry ----
  model.objects.forEach((obj, i) => {
    const pos = Buffer.from(obj.positions.buffer, obj.positions.byteOffset, obj.positions.byteLength);
    const nrm = obj.normals ? Buffer.from(obj.normals.buffer, obj.normals.byteOffset, obj.normals.byteLength) : null;
    const uv = obj.uvs ? Buffer.from(obj.uvs.buffer, obj.uvs.byteOffset, obj.uvs.byteLength) : null;
    const idx = Buffer.from(obj.indices.buffer, obj.indices.byteOffset, obj.indices.byteLength);

    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let k = 0; k < obj.positions.length; k += 3) {
      for (let a = 0; a < 3; a++) {
        const v = obj.positions[k + a];
        if (v < min[a]) min[a] = v;
        if (v > max[a]) max[a] = v;
      }
    }

    const prim = {
      attributes: {
        POSITION: (() => {
          json.accessors.push({ bufferView: addView(pad4(pos, 0), ARRAY_BUFFER), componentType: FLOAT, count: obj.positions.length / 3, type: 'VEC3', min, max });
          return json.accessors.length - 1;
        })(),
      },
      material: getMaterialIdx(obj.material),
      mode: 4,
    };
    if (nrm) {
      json.accessors.push({ bufferView: addView(pad4(nrm, 0), ARRAY_BUFFER), componentType: FLOAT, count: obj.normals.length / 3, type: 'VEC3' });
      prim.attributes.NORMAL = json.accessors.length - 1;
    }
    if (uv) {
      json.accessors.push({ bufferView: addView(pad4(uv, 0), ARRAY_BUFFER), componentType: FLOAT, count: obj.uvs.length / 2, type: 'VEC2' });
      prim.attributes.TEXCOORD_0 = json.accessors.length - 1;
    }
    json.accessors.push({ bufferView: addView(pad4(idx, 0), ELEMENT_ARRAY_BUFFER), componentType: UINT, count: obj.indices.length, type: 'SCALAR' });
    prim.indices = json.accessors.length - 1;

    json.meshes.push({ name: obj.name || `mesh_${i}`, primitives: [prim] });
    json.nodes.push({ name: obj.name || `node_${i}`, mesh: json.meshes.length - 1 });
    json.scenes[0].nodes.push(json.nodes.length - 1);
  });

  const binChunk = pad4(Buffer.concat(bins), 0);
  json.buffers.push({ byteLength: binChunk.length });

  let jsonStr = Buffer.from(JSON.stringify(json), 'utf8');
  if (jsonStr.length % 4) jsonStr = Buffer.concat([jsonStr, Buffer.alloc(4 - (jsonStr.length % 4), 0x20)]);

  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); // 'glTF'
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonStr.length + 8 + binChunk.length, 8);

  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonStr.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4); // 'JSON'

  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binChunk.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4); // 'BIN\0'

  return Buffer.concat([header, jsonHeader, jsonStr, binHeader, binChunk]);
}

function linearToSRGB(c) {
  const f = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
  return [f(c[0]), f(c[1]), f(c[2])];
}

/** Build OBJ (+MTL) text and texture files from a normalized model. */
export function buildOBJ(model, { textures = true, textureSize = 256 } = {}) {
  const mtlName = 'materials.mtl';
  const texFiles = new Map();
  const matDefs = [];
  const seenMat = new Map();

  const lines = [`# ${model.name} — exported by RoTools MCP`, `mtllib ${mtlName}`];
  let vOff = 1, vtOff = 1, vnOff = 1;

  model.objects.forEach((obj, oi) => {
    const mat = obj.material;
    let matKey = JSON.stringify([mat.color, mat.metalness, mat.roughness, textures ? mat.textureSpec : null]);
    if (!seenMat.has(matKey)) {
      const mid = `mat_${seenMat.size}`;
      seenMat.set(matKey, mid);
      const srgb = linearToSRGB(mat.color);
      let mapLine = '';
      if (textures && mat.textureSpec) {
        const texFile = `tex_${seenMat.size - 1}.png`;
        texFiles.set(texFile, renderTexturePNG(mat.textureSpec, textureSize));
        mapLine = `\nmap_Kd ${texFile}`;
      }
      matDefs.push(
        `newmtl ${mid}\nKa 1 1 1\nKd ${srgb.map((v) => v.toFixed(4)).join(' ')}\nKs 0 0 0\nNs 10\nPr ${(mat.roughness ?? 0.85).toFixed(3)}\nPm ${(mat.metalness ?? 0.1).toFixed(3)}${mapLine}`
      );
    }
    const mid = seenMat.get(matKey);

    lines.push(`o ${obj.name || `object_${oi}`}`, `g ${obj.name || `object_${oi}`}`, `usemtl ${mid}`);
    const p = obj.positions, n = obj.normals, uv = obj.uvs;
    for (let i = 0; i < p.length; i += 3) lines.push(`v ${p[i].toFixed(5)} ${p[i + 1].toFixed(5)} ${p[i + 2].toFixed(5)}`);
    if (uv) for (let i = 0; i < uv.length; i += 2) lines.push(`vt ${uv[i].toFixed(5)} ${uv[i + 1].toFixed(5)}`);
    if (n) for (let i = 0; i < n.length; i += 3) lines.push(`vn ${n[i].toFixed(4)} ${n[i + 1].toFixed(4)} ${n[i + 2].toFixed(4)}`);
    for (let i = 0; i < obj.indices.length; i += 3) {
      const faces = [0, 1, 2].map((k) => {
        const vi = obj.indices[i + k];
        return uv && n
          ? `${vi + vOff}/${vi + vtOff}/${vi + vnOff}`
          : n ? `${vi + vOff}//${vi + vnOff}` : `${vi + vOff}`;
      });
      lines.push(`f ${faces.join(' ')}`);
    }
    vOff += p.length / 3;
    if (uv) vtOff += uv.length / 2;
    if (n) vnOff += n.length / 3;
  });

  return {
    obj: lines.join('\n') + '\n',
    mtl: matDefs.join('\n\n') + '\n',
    mtlName,
    textures: texFiles,
  };
}
