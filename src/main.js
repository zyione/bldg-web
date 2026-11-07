import './style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createWindowEntries } from './windows.js';

const $ = selector => document.querySelector(selector);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, .05, 180);
const loader = new GLTFLoader();
let renderer, controls, currentModel, property, mode = 'exterior', requestId = 0;
let moving = false, destination, focus, finishIndex = 0, busy = false;
let windowEntries, exteriorView, activeEntry, transitioning = false;
const entryContainer = document.createElement('div');
entryContainer.id = 'window-entries';
document.body.append(entryContainer);
const veil = document.createElement('div');
veil.id = 'tour-veil'; veil.setAttribute('aria-hidden', 'true');
document.body.append(veil);
function cameraTween(position, target, duration) {
  const startPosition = camera.position.clone();
  const startTarget = controls.target.clone();
  moving = false;
  return new Promise(resolve => {
    const start = performance.now();
    function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = t * t * (3 - 2 * t);
      camera.position.lerpVectors(startPosition, new THREE.Vector3(...position), eased);
      controls.target.lerpVectors(startTarget, new THREE.Vector3(...target), eased);
      controls.update();
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    }
    requestAnimationFrame(tick);
  });
}
async function fade(visible) {
  veil.style.opacity = visible ? '1' : '0';
  await new Promise(resolve => setTimeout(resolve, reducedMotion.matches ? 80 : 280));
}
function enterWindow(entry) {
  if (busy || transitioning) return;
  $('#room').value = entry.room;
  loadView('interior', true, entry);
}
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const narrow = () => innerWidth < 760;
const status = text => { $('#status').textContent = text; };
const themeMedia = matchMedia('(prefers-color-scheme: dark)');
let theme = 'system';
try { theme = localStorage.getItem('arc-theme') || 'system'; } catch {}
$('#theme').value = theme;
function applyTheme() {
  const dark = theme === 'dark' || (theme === 'system' && themeMedia.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  scene.background = new THREE.Color(dark ? '#25322f' : '#dde4df');
  scene.fog = new THREE.Fog(dark ? '#25322f' : '#dde4df', 45, 95);
  document.querySelector('meta[name="theme-color"]').content = dark ? '#232b25' : '#ecebe3';
}
$('#theme').addEventListener('change', event => {
  theme = event.target.value;
  try { localStorage.setItem('arc-theme', theme); } catch {}
  applyTheme();
});
themeMedia.addEventListener('change', applyTheme);
applyTheme();
function dispose(model) {
  model.traverse(object => {
    object.geometry?.dispose();
    const materials = object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : [];
    for (const material of materials) {
      for (const value of Object.values(material)) if (value?.isTexture) value.dispose();
      material.dispose();
    }
  });
}
function setCamera(animated = true) {
  const room = property.rooms.find(item => item.id === $('#room').value) || property.rooms[0];
  const view = mode === 'interior' ? room.camera : property.camera;
  destination = new THREE.Vector3(...view.position);
  focus = new THREE.Vector3(...view.target);
  if (mode === 'exterior') {
    if (narrow()) { destination.multiplyScalar(1.9); focus.y += 5; }
    else focus.x -= 3.5;
  }
  controls.minDistance = mode === 'interior' ? .8 : 10;
  controls.maxDistance = mode === 'interior' ? 12 : 65;
  controls.maxPolarAngle = Math.PI * .49;
  moving = animated && !reducedMotion.matches;
  if (!moving) { camera.position.copy(destination); controls.target.copy(focus); controls.update(); }
}
function applyFinish() {
  if (!currentModel || mode !== 'interior') return;
  const finish = property.finishes[finishIndex];
  currentModel.traverse(object => {
    const materials = object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : [];
    for (const material of materials) if (finish.materials[material.name]) material.color.set(finish.materials[material.name]);
  });
  $('#finishes').querySelectorAll('button').forEach((button, index) => button.setAttribute('aria-pressed', String(index === finishIndex)));
  $('.palette-note').textContent = finish.name;
}
async function loadView(nextMode, animate = true, entry = null) {
  if (!property || !renderer || transitioning) return;
  if (nextMode === 'interior' && mode === 'exterior') entry ||= property.entries?.find(item => item.room === $('#room').value);
  const entering = nextMode === 'interior' && mode === 'exterior' && entry;
  const returning = nextMode === 'exterior' && mode === 'interior' && exteriorView;
  const transition = Boolean(animate && (entering || returning));
  const token = ++requestId;
  busy = true;
  entryContainer.querySelectorAll('button').forEach(button => { button.disabled = true; });
  $('#retry').hidden = true;
  status(nextMode === 'interior' ? 'Opening your space…' : 'Preparing the residence…');
  const room = property.rooms.find(item => item.id === $('#room').value) || property.rooms[0];
  const file = nextMode === 'interior' ? room.model : property.exterior;
  try {
    const result = await loader.loadAsync(`/properties/${property.id}/${file}`);
    if (token !== requestId) { dispose(result.scene); return; }
    if (transition) {
      transitioning = true;
      document.querySelectorAll('button, select').forEach(element => { element.disabled = true; });
      controls.enabled = false;
      controls.minDistance = .1; controls.maxDistance = 100;
      document.body.classList.add('tour-transitioning');
      if (entering) {
        exteriorView = { position: camera.position.toArray(), target: controls.target.toArray() };
        activeEntry = entry;
      }
      windowEntries?.dispose(); windowEntries = null;
      if (!reducedMotion.matches) {
        const approach = entering ? entry.approach : activeEntry.interiorEntry;
        await cameraTween(approach.position, approach.target, 1050);
      }
      await fade(true);
    }
    windowEntries?.dispose(); windowEntries = null;
    if (currentModel) { scene.remove(currentModel); dispose(currentModel); }
    currentModel = result.scene;
    currentModel.traverse(object => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } });
    scene.add(currentModel);
    mode = nextMode;
    document.body.classList.toggle('inside', mode === 'interior');
    $('.interior-panel').hidden = mode !== 'interior';
    for (const id of ['exterior', 'overview']) $(`#${id}`).classList.toggle('active', mode === 'exterior');
    for (const id of ['interior', 'interiorNav']) $(`#${id}`).classList.toggle('active', mode === 'interior');
    applyFinish();
    setCamera(animate);
    if (transition) {
      moving = false;
      const start = entering ? entry.interiorEntry : activeEntry.approach;
      camera.position.fromArray(start.position); controls.target.fromArray(start.target);
      controls.minDistance = .1; controls.maxDistance = 100;
      controls.update();
      await fade(false);
      const end = entering ? room.camera : exteriorView;
      await cameraTween(end.position, end.target, reducedMotion.matches ? 1 : 950);
      controls.minDistance = mode === 'interior' ? .8 : 10;
      controls.maxDistance = mode === 'interior' ? 12 : 65;
      if (returning) { exteriorView = null; activeEntry = null; }
    }
    if (mode === 'exterior') windowEntries = createWindowEntries(scene, camera, renderer, currentModel, property.entries || [], enterWindow);
    $('#exterior').textContent = mode === 'interior' ? 'Back outside' : 'Exterior';
    status('');
  } catch (error) {
    if (token !== requestId) return;
    status('This space could not load. Please retry or choose another residence.');
    $('#retry').hidden = false;
    $('#retry').onclick = () => loadView(nextMode);
    console.error(error);
  } finally {
    if (token === requestId) busy = false;
    if (token === requestId) entryContainer.querySelectorAll('button').forEach(button => { button.disabled = false; });
    if (transitioning) {
      transitioning = false; controls.enabled = true;
      document.querySelectorAll('button, select').forEach(element => { element.disabled = false; });
      document.body.classList.remove('tour-transitioning'); veil.style.opacity = '0';
      $('#exterior').focus({ preventScroll: true });
    }
  }
}
async function readJSON(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Unable to load ${path}`);
  return response.json();
}
let propertyRequest = 0;
async function selectProperty(id) {
  if (transitioning) return;
  windowEntries?.dispose(); windowEntries = null;
  const token = ++propertyRequest;
  ++requestId;
  status('Loading residence…');
  try {
    const next = await readJSON(`/properties/${id}/property.json`);
    if (token !== propertyRequest) return;
    property = next;
    exteriorView = null; activeEntry = null;
    finishIndex = 0;
    $('#description').textContent = property.description;
    $('#location').textContent = property.location;
    $('#room').replaceChildren(...property.rooms.map(room => new Option(room.name, room.id)));
    $('#finishes').replaceChildren(...property.finishes.map((finish, index) => {
      const button = document.createElement('button');
      button.className = 'swatch'; button.style.background = finish.swatch;
      button.title = finish.name; button.setAttribute('aria-label', finish.name);
      button.onclick = () => { finishIndex = index; applyFinish(); };
      return button;
    }));
    await loadView('exterior', false);
  } catch (error) { if (token !== propertyRequest) return; status('Unable to load residence details. Choose another residence or retry.'); $('#retry').hidden = false; $('#retry').onclick = () => selectProperty(id); console.error(error); }
}
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  $('#scene').append(renderer.domElement);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.addEventListener('start', () => { moving = false; });
  scene.add(new THREE.HemisphereLight('#fff8e8', '#798b74', 2.8));
  const sun = new THREE.DirectionalLight('#fff2d9', 4);
  sun.position.set(-12, 20, 15); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, far: 70 });
  sun.shadow.normalBias = .03; scene.add(sun);
  let previous = performance.now();
  renderer.setAnimationLoop(now => {
    const dt = Math.min((now - previous) / 1000, .1); previous = now;
    if (moving) {
      const blend = 1 - Math.exp(-dt * 4);
      camera.position.lerp(destination, blend); controls.target.lerp(focus, blend);
      if (camera.position.distanceTo(destination) < .015) moving = false;
    }
    controls.update(); windowEntries?.update(); renderer.render(scene, camera);
  });
  renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); status('The 3D view was interrupted. Reload to restore it.'); $('#retry').hidden = false; $('#retry').textContent = 'Reload view'; $('#retry').onclick = () => location.reload(); });
  const ids = await readJSON('/properties/index.json');
  const properties = await Promise.all(ids.map(id => readJSON(`/properties/${id}/property.json`)));
  $('#property').replaceChildren(...properties.map(item => new Option(item.name, item.id)));
  await selectProperty(ids[0]);
} catch (error) { status(''); $('#fallback').hidden = false; console.error(error); }
for (const id of ['enter', 'explore', 'interior', 'interiorNav']) $(`#${id}`).onclick = () => loadView('interior');
for (const id of ['exterior', 'overview']) $(`#${id}`).onclick = () => loadView('exterior');
$('#reset').onclick = () => { if (property && controls && !transitioning) setCamera(); };
$('#property').onchange = event => selectProperty(event.target.value);
$('#room').onchange = () => loadView('interior');
let lastWheel = 0;
renderer?.domElement.addEventListener('wheel', event => {
  if (busy || Math.abs(event.deltaY) < 15 || performance.now() - lastWheel < 1400) return;
  lastWheel = performance.now();
  if (event.deltaY > 0 && mode === 'exterior') loadView('interior');
  if (event.deltaY < 0 && mode === 'interior') loadView('exterior');
}, { passive: true });
addEventListener('resize', () => {
  if (!renderer) return;
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
  if (property && !transitioning) setCamera(false);
});
