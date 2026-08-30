import fs from 'node:fs';
import path from 'node:path';
import { buildGLB, buildOBJ } from './gltf.js';
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

  return {
    glbPath, objPath,
    glbUrl: `/api/models/${id}/file.glb`,
    objUrl: `/api/models/${id}/file.obj`,
  };
}

export function writeExportFile(fileName, data) {
  const dir = outputDir();
  const p = path.join(dir, fileName);
  fs.writeFileSync(p, data);
  return p;
}
