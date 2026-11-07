const fs = require('node:fs');
const { SkpFile, toInstancedGLB } = require('openskp');

// Run from the repository root. The original SKP stays outside published assets.
const source = process.argv[2] || 'Contemporary+Suburban+House+3.skp';
const scene = SkpFile.open(source).buildInstancedScene();
const original = Buffer.from(toInstancedGLB(scene, { textures: true }));
const originalJsonLength = original.readUInt32LE(12);
const document = JSON.parse(original.toString('utf8', 20, 20 + originalJsonLength));

// OpenSKP omits material names. Stable indices make finish presets reproducible.
document.materials.forEach((material, index) => { material.name = 'Surface_' + index; });
const json = Buffer.from(JSON.stringify(document));
const paddedJson = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32);
json.copy(paddedJson);
const binaryChunk = original.subarray(20 + originalJsonLength);
const output = Buffer.alloc(20 + paddedJson.length + binaryChunk.length);
original.copy(output, 0, 0, 12);
output.writeUInt32LE(output.length, 8);
output.writeUInt32LE(paddedJson.length, 12);
output.writeUInt32LE(0x4e4f534a, 16);
paddedJson.copy(output, 20);
binaryChunk.copy(output, 20 + paddedJson.length);
fs.mkdirSync('public/properties/suburban', { recursive: true });
fs.writeFileSync('public/properties/suburban/house.glb', output);
console.log('Converted ' + source + ' to textured GLB (' + output.length + ' bytes).');
