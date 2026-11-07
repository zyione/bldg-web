import { readFile, access } from 'node:fs/promises';
const root = new URL('../public/properties/', import.meta.url);
const read = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const assert = (value, message) => { if (!value) throw new Error(message); };
const ids = await read('index.json');
assert(ids.length && new Set(ids).size === ids.length, 'Property IDs must be unique');
for (const id of ids) {
  assert(/^[a-z0-9-]+$/.test(id), 'Invalid property ID');
  const p = await read(`${id}/property.json`);
  assert(p.id === id && p.name && p.rooms?.length && p.finishes?.length, `Incomplete property ${id}`);
  assert(new Set(p.rooms.map(r => r.id)).size === p.rooms.length, `Duplicate room IDs in ${id}`);
  const entries = p.entries || [];
  assert(new Set(entries.map(entry => entry.id)).size === entries.length, `Duplicate window IDs in ${id}`);
  for (const entry of entries) {
    assert(entry.id && entry.label && p.rooms.some(room => room.id === entry.room), `Invalid window room in ${id}`);
    for (const vector of [entry.position, entry.size, entry.approach?.position, entry.approach?.target, entry.interiorEntry?.position, entry.interiorEntry?.target]) {
      assert(vector?.length === 3 && vector.every(Number.isFinite), `Invalid window coordinates in ${id}`);
    }
    assert(entry.size.every(value => value > 0), `Window dimensions must be positive in ${id}`);
  }
  for (const view of [p, ...p.rooms]) {
    for (const key of ['position', 'target']) assert(view.camera?.[key]?.length === 3 && view.camera[key].every(Number.isFinite), `Invalid camera in ${id}`);
  }
  for (const file of [p.exterior, ...p.rooms.map(r => r.model)]) {
    assert(typeof file === 'string' && !file.includes('..') && !file.startsWith('/'), `Invalid asset path ${file}`);
    await access(new URL(`${id}/${file}`, root));
    const bytes = await readFile(new URL(`${id}/${file}`, root));
    assert(bytes.toString('utf8', 0, 4) === 'glTF', `Invalid GLB ${file}`);
    const jsonLength = bytes.readUInt32LE(12);
    const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength));
    const names = new Set(gltf.materials?.map(m => m.name));
    if (p.rooms.some(r => r.model === file)) for (const finish of p.finishes) {
      assert(/^#[0-9a-f]{6}$/i.test(finish.swatch), 'Invalid swatch');
      for (const [name, color] of Object.entries(finish.materials)) {
        assert(names.has(name), `Missing material ${name} in ${file}`);
        assert(/^#[0-9a-f]{6}$/i.test(color), `Invalid colour for ${name}`);
      }
    }
  }
}
console.log(`Validated ${ids.length} properties, cameras, GLBs and material presets.`);
