import { generateModel } from '../tools/generateModel.js';
import { outputDir } from '../config.js';
import fs from 'node:fs';
import path from 'node:path';

const r = await generateModel({
  name: 'ThumbTest',
  withTextures: true,
  code: `const g = new THREE.IcosahedronGeometry(1.6, 3);
displace(g, 0.45, 2, 9);
const rock = new THREE.Mesh(g, makeMaterial({ color: '#7a7a72', texture: { type: 'noise', colors: ['#8a8a80', '#4a4a44'], scale: 6 } }));
rock.name = 'Rock';
scene.add(rock);`,
});

const p = path.join(outputDir(), 'models', `${r.modelId}.thumb.png`);
const buf = fs.readFileSync(p);
console.log('thumb:', r.modelId + '.thumb.png', '|', buf.length, 'bytes | PNG magic:', buf[0] === 0x89 && buf[1] === 0x50);
console.log('thumbUrl in result:', r.exported && !!r.exported.objUrl ? '(saved via modelStore)' : '');
process.exit(0);
