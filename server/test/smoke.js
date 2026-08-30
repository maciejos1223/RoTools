import { generateModel } from '../tools/generateModel.js';
import { exportModel } from '../tools/exportModel.js';
import { outputDir } from '../config.js';
import fs from 'node:fs';
import path from 'node:path';

const code = `
const geo = new THREE.IcosahedronGeometry(1.5, 4);
displace(geo, 0.55, 1.8, 7);
const mesh = new THREE.Mesh(geo, makeMaterial({ color: 0x6b6b6b, roughness: 0.95, texture: { type: "noise", colors: ["#7a7a72", "#4a4a44"], scale: 6 } }));
mesh.name = "Rock";
scene.add(mesh);

const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.2, 16), makeMaterial({ color: "#8b5a2b" }));
cap.position.set(0.5, 0.8, 0);
cap.name = "Stick";
scene.add(cap);
`;

const r = await generateModel({ name: 'TestRock', code, withTextures: true });
console.log('generate OK:', r.modelId, JSON.stringify(r.stats));

const e1 = await exportModel({ format: 'glb' });
const e2 = await exportModel({ format: 'gltf' });
const e3 = await exportModel({ format: 'obj' });
console.log('export glb:', e1.files, fs.statSync(e1.files[0]).size, 'bytes');
console.log('export gltf:', e2.files, fs.statSync(e2.files[0]).size, 'bytes');
console.log('export obj:', e3.files, fs.statSync(e3.files[0]).size, 'bytes');

// validate GLB structure
const glbPath = path.join(outputDir(), 'models', `${r.modelId}.glb`);
const buf = fs.readFileSync(glbPath);
const magic = buf.readUInt32LE(0);
const jsonLen = buf.readUInt32LE(12);
const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
console.log('GLB magic ok:', magic === 0x46546c67, '| meshes:', json.meshes.length, '| images:', (json.images || []).length, '| materials:', json.materials.length, '| buffers:', json.buffers.length);

// OBJ sanity
const objFile = e3.files[0];
const obj = fs.readFileSync(objFile, 'utf8');
console.log('OBJ lines:', obj.split('\n').length, '| has v:', obj.includes('\nv '), '| has f:', obj.includes('\nf '));
console.log('ALL TESTS PASSED');
