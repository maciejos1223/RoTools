import fs from 'node:fs';
import path from 'node:path';
import { buildGLB, buildOBJ } from './gltf.js';
import { renderThumbnailPNG } from './thumbnail.js';
import { outputDir } from '../config.js';

/** In-memory store of extracted model data (for export / re-import). */
const models = new Map();

export function rememberModel(id, name, modelData, withTextures) {
  models.set(id, { name, modelData, withTextures });
  if (models.size > 25) models.delete(models.keys().next().value);
}

export function getModel(id) {
  return models.get(id) || null;
}

/** Write GLB + OBJ(+MTL) to exports/models and return URLs/paths. */
export function saveModelFiles(id, name, modelData, withTextures) {
  const dir = path.join(outputDir(), 'models');
  fs.mkdirSync(dir, { recursive: true });

  const glbBuf = buildGLB({ name, objects: modelData.objects }, { textures: withTextures });
  const glbPath = path.join(dir, `${id}.glb`);
  fs.writeFileSync(glbPath, glbBuf);

  const { obj, mtl, mtlName, textures: texFiles } = buildOBJ({ name, objects: modelData.objects }, { textures: withTextures });
  const objPath = path.join(dir, `${id}.obj`);
  fs.writeFileSync(objPath, obj);
  fs.writeFileSync(path.join(dir, `${id}.mtl`), mtl);
  for (const [texName, buf] of texFiles) fs.writeFileSync(path.join(dir, texName), buf);

  // thumbnail (best effort — never break generation over a preview image)
  let thumbPath = null;
  try {
    thumbPath = path.join(dir, `${id}.thumb.png`);
    fs.writeFileSync(thumbPath, renderThumbnailPNG(modelData.objects, 256));
  } catch (err) {
    console.error('thumbnail failed:', err.message);
    thumbPath = null;
  }

  return {
    glbPath, objPath, thumbPath,
    glbUrl: `/api/models/${id}/file.glb`,
    objUrl: `/api/models/${id}/file.obj`,
    thumbUrl: thumbPath ? `/api/models/${id}/thumb.png` : null,
  };
}

export function writeExportFile(fileName, data) {
  const dir = outputDir();
  const p = path.join(dir, fileName);
  fs.writeFileSync(p, data);
  return p;
}
