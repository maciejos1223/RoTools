import vm from 'node:vm';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const MAX_OBJECTS = 400;
const MAX_VERTS = 200_000;

/* ---------- deterministic noise ---------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash3(x, y, z) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const smooth = (t) => t * t * (3 - 2 * t);

function valueNoise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = smooth(xf), v = smooth(yf), w = smooth(zf);
  const lerp = (a, b, t) => a + (b - a) * t;
  const c000 = hash3(xi, yi, zi), c100 = hash3(xi + 1, yi, zi);
  const c010 = hash3(xi, yi + 1, zi), c110 = hash3(xi + 1, yi + 1, zi);
  const c001 = hash3(xi, yi, zi + 1), c101 = hash3(xi + 1, yi, zi + 1);
  const c011 = hash3(xi, yi + 1, zi + 1), c111 = hash3(xi + 1, yi + 1, zi + 1);
  return lerp(
    lerp(lerp(c000, c100, u), lerp(c010, c110, u), v),
    lerp(lerp(c001, c101, u), lerp(c011, c111, u), v),
    w
  );
}

function fbm3(x, y, z, oct = 4) {
  let amp = 0.5, f = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * valueNoise3(x * f, y * f, z * f);
    norm += amp; amp *= 0.5; f *= 2;
  }
  return sum / norm;
}

/** Displace vertices along normals using 3D noise — makes rocks, terrain, organic shapes. */
function displace(geometry, amount = 0.3, freq = 2, seed = 1) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = g.attributes.position;
  const nrmAttr = g.attributes.normal;
  g.computeVertexNormals();
  const nrm = g.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
    const n = fbm3(px * freq + seed * 17.17, py * freq + seed * 9.31, pz * freq + seed * 3.71, 4) - 0.5;
    const nx = nrm.getX(i), ny = nrm.getY(i), nz = nrm.getZ(i);
    pos.setXYZ(i, px + nx * n * amount, py + ny * n * amount, pz + nz * n * amount);
  }
  if (nrmAttr) g.attributes.normal = nrmAttr;
  g.computeVertexNormals();
  return g;
}

/* ---------- sandbox ---------- */
export function runModelCode(code, { withTextures = false } = {}) {
  const scene = new THREE.Scene();
  const rng = mulberry32(Date.now() % 100000);

  const makeMaterial = (opts = {}) => {
    const { color = '#888888', metalness = 0.1, roughness = 0.85, texture = null, doubleSided = false, ...rest } = opts;
    const mat = new THREE.MeshStandardMaterial({ color, metalness, roughness, side: doubleSided ? THREE.DoubleSide : THREE.FrontSide, ...rest });
    if (texture && withTextures) mat.userData.textureSpec = texture;
    return mat;
  };

  const helpers = {
    makeMaterial,
    mergeGeometries,
    displace,
    noise3: (x, y, z) => fbm3(x, y, z),
    rand: rng,
    randRange: (a, b) => a + rng() * (b - a),
  };

  const sandbox = {
    THREE, scene, ...helpers,
    console: { log: (...a) => console.log('[model-code]', ...a), warn: (...a) => console.warn('[model-code]', ...a) },
    Math, JSON, Object, Array, Number, String, Boolean, Date, isFinite, parseFloat, parseInt, NaN, Infinity,
    Float32Array, Uint16Array, Uint32Array, Int32Array,
  };
  sandbox.globalThis = sandbox;

  const context = vm.createContext(sandbox);
  try {
    vm.runInContext(code, context, { timeout: 8000, displayErrors: true, filename: 'model-code.js' });
  } catch (err) {
    const e = new Error(`Model code failed: ${err.message}`);
    e.stack = err.stack;
    throw e;
  }

  return extractModel(scene, { withTextures });
}

/* ---------- extraction ---------- */
function extractModel(scene, { withTextures }) {
  const objects = [];
  let verts = 0, tris = 0;

  scene.updateMatrixWorld(true);

  scene.traverse((node) => {
    if (objects.length >= MAX_OBJECTS) return;
    if (!(node.isMesh)) return;
    let geo = node.geometry;
    if (!geo || !geo.attributes || !geo.attributes.position) return;

    geo = geo.clone();
    geo.applyMatrix4(node.matrixWorld);
    if (!geo.index) {
      const n = geo.attributes.position.count;
      geo.setIndex(Array.from({ length: n }, (_, i) => i));
    }

    if (!geo.attributes.normal) geo.computeVertexNormals();

    let uvs = null;
    if (geo.attributes.uv) {
      uvs = new Float32Array(geo.attributes.uv.array);
    }

    const mat = Array.isArray(node.material) ? node.material[0] : node.material;
    const material = {
      name: mat && mat.name ? mat.name : 'mat',
      color: mat && mat.color ? [mat.color.r, mat.color.g, mat.color.b] : [0.6, 0.6, 0.6],
      metalness: mat ? mat.metalness ?? 0.1 : 0.1,
      roughness: mat ? mat.roughness ?? 0.85 : 0.85,
      doubleSided: mat ? mat.side === THREE.DoubleSide : false,
      textureSpec: withTextures && mat && mat.userData.textureSpec ? mat.userData.textureSpec : null,
    };

    if (material.textureSpec && !uvs) {
      // planar UV projection from bounding box
      geo.computeBoundingBox();
      const bb = geo.boundingBox;
      const size = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z];
      const axes = size[0] >= size[1] && size[0] >= size[2] ? [1, 2] : size[1] >= size[2] ? [0, 2] : [0, 1];
      const min0 = bb.min[axes[0] === 0 ? 'x' : axes[0] === 1 ? 'y' : 'z'];
      const min1 = bb.min[axes[1] === 0 ? 'x' : axes[1] === 1 ? 'y' : 'z'];
      const max0 = bb.max[axes[0] === 0 ? 'x' : axes[0] === 1 ? 'y' : 'z'];
      const max1 = bb.max[axes[1] === 0 ? 'x' : axes[1] === 1 ? 'y' : 'z'];
      const posAttr = geo.attributes.position;
      const uvArr = new Float32Array(posAttr.count * 2);
      const comp = (i, axis) => (axis === 0 ? posAttr.getX(i) : axis === 1 ? posAttr.getY(i) : posAttr.getZ(i));
      for (let i = 0; i < posAttr.count; i++) {
        uvArr[i * 2] = (comp(i, axes[0]) - min0) / Math.max(1e-6, max0 - min0);
        uvArr[i * 2 + 1] = (comp(i, axes[1]) - min1) / Math.max(1e-6, max1 - min1);
      }
      uvs = uvArr;
    }

    const positions = new Float32Array(geo.attributes.position.array);
    const normals = new Float32Array(geo.attributes.normal.array);
    const indices = geo.index ? new Uint32Array(geo.index.array) : null;

    verts += positions.length / 3;
    tris += indices ? indices.length / 3 : positions.length / 3;
    if (verts > MAX_VERTS) throw new Error(`Model too large: >${MAX_VERTS} vertices`);

    objects.push({
      name: node.name || `mesh_${objects.length}`,
      positions,
      normals,
      uvs,
      indices,
      material,
    });
  });

  if (!objects.length) {
    throw new Error('No meshes found. Create THREE.Mesh objects and add them to `scene`.');
  }

  // bounds
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());

  return {
    objects,
    stats: {
      objects: objects.length,
      vertices: verts,
      triangles: tris,
      size: {
        x: +size.x.toFixed(3), y: +size.y.toFixed(3), z: +size.z.toFixed(3),
      },
    },
  };
}
