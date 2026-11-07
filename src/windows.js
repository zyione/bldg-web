import * as THREE from 'three';

/** Window volumes use the same coordinates as the exterior GLB. */
export function createWindowEntries(scene, camera, renderer, model, entries, enter) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hovered = null;
  let pointerDown = null;
  const items = entries.map(entry => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(...entry.size),
      new THREE.MeshBasicMaterial({ color: '#d8ed9d', transparent: true, opacity: 0, depthWrite: false }),
    );
    mesh.position.set(...entry.position);
    scene.add(mesh);
    const button = document.createElement('button');
    button.className = 'window-entry';
    button.setAttribute('aria-label', entry.label);
    const icon = document.createElement('span');
    icon.textContent = '↗';
    const label = document.createElement('span');
    label.className = 'window-entry-label'; label.textContent = entry.label;
    button.append(icon, label);
    button.onclick = () => enter(entry);
    button.onfocus = () => highlight(mesh);
    button.onblur = () => highlight(null);
    button.onpointerenter = () => highlight(mesh);
    button.onpointerleave = () => highlight(null);
    document.querySelector('#window-entries').append(button);
    return { entry, mesh, button };
  });
  function highlight(mesh) {
    hovered = mesh;
    items.forEach(item => {
      item.mesh.material.opacity = item.mesh === mesh ? .35 : .04;
      item.button.classList.toggle('hovered', item.mesh === mesh);
    });
    renderer.domElement.style.cursor = mesh ? 'pointer' : 'grab';
  }
  function pick(event) {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(items.map(item => item.mesh))[0];
    if (!hit) return null;
    const wall = raycaster.intersectObject(model, true)[0];
    return wall && wall.distance < hit.distance - .15 ? null : hit.object;
  }
  const move = event => highlight(pick(event));
  const leave = () => highlight(null);
  const down = event => { pointerDown = [event.clientX, event.clientY]; };
  const up = event => {
    if (!pointerDown || Math.hypot(event.clientX - pointerDown[0], event.clientY - pointerDown[1]) > 6) return;
    pointerDown = null;
    const mesh = pick(event);
    const item = items.find(item => item.mesh === mesh);
    if (item) enter(item.entry);
  };
  const handlers = { pointermove: move, pointerleave: leave, pointerdown: down, pointerup: up };
  for (const [event, handler] of Object.entries(handlers)) renderer.domElement.addEventListener(event, handler);
  highlight(null);
  return {
    update() {
      scene.updateMatrixWorld();
      items.forEach(({ mesh, button }) => {
        const point = mesh.position.clone().project(camera);
        const direction = mesh.position.clone().sub(camera.position);
        raycaster.set(camera.position, direction.clone().normalize());
        const wall = raycaster.intersectObject(model, true)[0];
        const obscured = wall && wall.distance < direction.length() - .3;
        button.hidden = point.z < -1 || point.z > 1 || Math.abs(point.x) > 1 || Math.abs(point.y) > 1 || obscured;
        button.style.left = `${(point.x + 1) * innerWidth / 2}px`;
        button.style.top = `${(1 - point.y) * innerHeight / 2}px`;
      });
    },
    dispose() {
      for (const [event, handler] of Object.entries(handlers)) renderer.domElement.removeEventListener(event, handler);
      items.forEach(({ mesh, button }) => { scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); button.remove(); });
      renderer.domElement.style.cursor = '';
      hovered = null;
    },
  };
}
