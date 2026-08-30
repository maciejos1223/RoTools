import { encodePNG } from './png.js';

function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

function smooth(t) { return t * t * (3 - 2 * t); }

function valueNoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  const u = smooth(xf), v = smooth(yf);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

export function fbm(x, y, octaves = 4) {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, y * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

function mix(c1, c2, t) {
  return [
    Math.round((c1[0] + (c2[0] - c1[0]) * t)),
    Math.round((c1[1] + (c2[1] - c1[1]) * t)),
    Math.round((c1[2] + (c2[2] - c1[2]) * t)),
  ];
}

/**
 * Generate procedural texture pixel generator.
 * spec: { type, colors: ['#hex', ...], scale }
 */
export function makePixelFn(spec) {
  const type = spec.type || 'noise';
  const colors = (spec.colors && spec.colors.length ? spec.colors : ['#888888', '#555555'])
    .map(hexToRgb);
  const s = spec.scale || 8;

  const pick = (t) => {
    if (colors.length === 1) return colors[0];
    const x = Math.min(colors.length - 1, Math.max(0, t * (colors.length - 1)));
    const i = Math.min(colors.length - 2, Math.floor(x));
    return mix(colors[i], colors[i + 1], x - i);
  };

  switch (type) {
    case 'checker':
      return (u, v) => {
        const c = ((Math.floor(u * s) + Math.floor(v * s)) & 1);
        return colors[c % colors.length];
      };
    case 'grid':
      return (u, v) => {
        const fu = Math.abs(((u * s) % 1) - 0.5), fv = Math.abs(((v * s) % 1) - 0.5);
        const line = Math.min(fu, fv) > 0.44 ? 1 : 0;
        return line ? colors[colors.length - 1] : colors[0];
      };
    case 'stripes':
      return (u) => pick(Math.abs(Math.sin(u * Math.PI * s)));
    case 'dots':
      return (u, v) => {
        const d = Math.hypot(((u * s) % 1) - 0.5, ((v * s) % 1) - 0.5);
        return d < 0.3 ? colors[colors.length - 1] : colors[0];
      };
    case 'gradient':
      return (u, v) => pick(v);
    case 'brick':
      return (u, v) => {
        const row = Math.floor(v * s);
        const uu = (u * s + (row % 2 ? 0.5 : 0)) % 1;
        const mortar = (uu % 1) < 0.05 || (v * s % 1) < 0.08;
        return mortar ? colors[colors.length - 1] : pick(hash2(row, Math.floor(u * s + (row % 2 ? 0.5 : 0)) * 57) * 0.3 + 0.35);
      };
    case 'wood':
      return (u, v) => pick(0.5 + 0.5 * Math.sin((u * s) + fbm(u * 6, v * 6) * 4));
    case 'marble':
      return (u, v) => pick(0.5 + 0.5 * Math.sin((u + fbm(u * 5, v * 5, 6)) * Math.PI * s));
    case 'noise':
    default:
      return (u, v) => pick(fbm(u * s, v * s, 5));
  }
}

export function hexToRgb(hex) {
  const h = String(hex).replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Render a procedural spec to a PNG buffer. */
export function renderTexturePNG(spec, size = 256) {
  const fn = makePixelFn(spec);
  const rgba = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = fn(x / size, y / size);
      const i = (y * size + x) * 4;
      rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255;
    }
  }
  return encodePNG(rgba, size, size);
}
