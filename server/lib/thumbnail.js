import { encodePNG } from './png.js';

/**
 * Software-rasterized 3D thumbnail (orthographic, z-buffered, lambert-shaded).
 * No GPU/headless-GL needed — works on raw mesh data straight from the sandbox.
 * Returns a PNG buffer with transparent background.
 */
export function renderThumbnailPNG(objects, size = 256) {
  const SS = 2; // supersample factor for cheap anti-aliasing
  const W = size * SS;

  // ---- bounds ----
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const obj of objects) {
    const p = obj.positions;
    for (let i = 0; i < p.length; i += 3) {
      if (p[i] < minX) minX = p[i];
      if (p[i] > maxX) maxX = p[i];
      if (p[i + 1] < minY) minY = p[i + 1];
      if (p[i + 1] > maxY) maxY = p[i + 1];
      if (p[i + 2] < minZ) minZ = p[i + 2];
      if (p[i + 2] > maxZ) maxZ = p[i + 2];
    }
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
  const extent = Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 1;

  // ---- camera (isometric-ish) ----
  const dir = norm([1, 0.75, 1]);            // eye direction from center
  const right = norm(cross([0, 1, 0], dir)); // screen +x
  const up = cross(dir, right);              // screen +y
  const scale = (W * 0.42) / extent;
  const light = norm([-0.6, 0.9, 0.35]);     // key light in world space

  // ---- raster ----
  const color = new Float32Array(W * W * 4); // premultiplied-over RGBA
  const depth = new Float32Array(W * W).fill(Infinity);

  const project = (x, y, z) => {
    const dx = x - cx, dy = y - cy, dz = z - cz;
    return [
      W / 2 + (dx * right[0] + dy * right[1] + dz * right[2]) * scale,
      W / 2 - (dx * up[0] + dy * up[1] + dz * up[2]) * scale,
      dx * dir[0] + dy * dir[1] + dz * dir[2], // depth along view axis
    ];
  };

  for (const obj of objects) {
    const p = obj.positions;
    const idx = obj.indices;
    const [br, bg, bb] = obj.material?.color || [0.62, 0.62, 0.62];
    const triCount = idx.length / 3;
    // cap work on very dense meshes: stride-skip triangles
    const stride = triCount > 60000 ? Math.ceil(triCount / 60000) : 1;

    for (let t = 0; t < triCount; t += stride) {
      const ia = idx[t * 3] * 3, ib = idx[t * 3 + 1] * 3, ic = idx[t * 3 + 2] * 3;
      const ax = p[ia], ay = p[ia + 1], az = p[ia + 2];
      const bx = p[ib], by = p[ib + 1], bz = p[ib + 2];
      const cxx = p[ic], cyy = p[ic + 1], czz = p[ic + 2];

      // world-space normal
      const e1 = [bx - ax, by - ay, bz - az];
      const e2 = [cxx - ax, cyy - ay, czz - az];
      let n = cross(e1, e2);
      const nlen = Math.hypot(n[0], n[1], n[2]) || 1;
      n = [n[0] / nlen, n[1] / nlen, n[2] / nlen];
      // face the camera
      let facing = n[0] * dir[0] + n[1] * dir[1] + n[2] * dir[2];
      if (facing > 0) n = [-n[0], -n[1], -n[2]];
      const lambert = Math.max(0, -(n[0] * light[0] + n[1] * light[1] + n[2] * light[2]));
      const shade = 0.32 + 0.68 * lambert;

      const [sx1, sy1, d1] = project(ax, ay, az);
      const [sx2, sy2, d2] = project(bx, by, bz);
      const [sx3, sy3, d3] = project(cxx, cyy, czz);

      // pixel-space bbox
      const x0 = Math.max(0, Math.floor(Math.min(sx1, sx2, sx3)));
      const x1 = Math.min(W - 1, Math.ceil(Math.max(sx1, sx2, sx3)));
      const y0 = Math.max(0, Math.floor(Math.min(sy1, sy2, sy3)));
      const y1 = Math.min(W - 1, Math.ceil(Math.max(sy1, sy2, sy3)));
      if (x1 < x0 || y1 < y0) continue;

      const area = (sx2 - sx1) * (sy3 - sy1) - (sx3 - sx1) * (sy2 - sy1);
      if (Math.abs(area) < 1e-9) continue;

      for (let py = y0; py <= y1; py++) {
        for (let px = x0; px <= x1; px++) {
          const pxc = px + 0.5, pyc = py + 0.5;
          // barycentric via edge functions
          const l1 = ((sx2 - pxc) * (pyc - sy3) - (sx3 - pxc) * (pyc - sy2)) / area;
          const l2 = ((sx3 - pxc) * (pyc - sy1) - (sx1 - pxc) * (pyc - sy3)) / area;
          const l3 = 1 - l1 - l2;
          if (l1 < 0 || l2 < 0 || l3 < 0) continue;
          const d = d1 * l3 + d2 * l1 + d3 * l2;
          const di = py * W + px;
          if (d >= depth[di]) continue;
          depth[di] = d;
          const ci = di * 4;
          color[ci] = br * shade;
          color[ci + 1] = bg * shade;
          color[ci + 2] = bb * shade;
          color[ci + 3] = 1;
        }
      }
    }
  }

  // ---- downsample SS×SS with alpha coverage ----
  const out = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const ci = ((y * SS + sy) * W + x * SS + sx) * 4;
          const alpha = color[ci + 3];
          r += color[ci] * alpha;
          g += color[ci + 1] * alpha;
          b += color[ci + 2] * alpha;
          a += alpha;
        }
      }
      const n = SS * SS;
      const oi = (y * size + x) * 4;
      if (a > 0) {
        out[oi] = Math.min(255, Math.round((r / a) * 255));
        out[oi + 1] = Math.min(255, Math.round((g / a) * 255));
        out[oi + 2] = Math.min(255, Math.round((b / a) * 255));
        out[oi + 3] = Math.round((a / n) * 255);
      }
    }
  }
  return encodePNG(out, size, size);
}

/* ---------- vec helpers ---------- */
function norm(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
