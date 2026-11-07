import * as THREE from 'three';

/** Window volumes use the same coordinates as the exterior GLB. */
export function createWindowEntries(scene, camera, renderer, model, entries, enter) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hovered = null;
  let pointerDown = null;
  let dwellTimer;
  let pendingMesh;
  function cancelHover() {
    clearTimeout(dwellTimer);
    pendingMesh = null;
    items.forEach(({ button }) => button.classList.remove('entering'));
  }
  function hover(mesh, event) {
    highlight(mesh);
    if (!mesh || event.buttons || pointerDown || event.pointerType !== 'mouse') {
      cancelHover();
      return;
    }
    if (mesh === pendingMesh) return;
    cancelHover();
    pendingMesh = mesh;
    const item = items.find(item => item.mesh === mesh);
    item.button.classList.add('entering');
    dwellTimer = setTimeout(() => {
      if (document.hasFocus() && !item.button.hidden && !item.button.disabled) enter(item.entry);
      cancelHover();
    }, 650);
  }
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
    button.onpointermove = event => hover(mesh, event);
    button.onpointerdown = cancelHover;
    button.onpointerleave = () => { cancelHover(); highlight(null); };
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
    if (hit) {
      const wall = raycaster.intersectObject(model, true)[0];
      if (!wall || wall.distance >= hit.distance - .15) return hit.object;
    }
    // Small panes need a little screen-space tolerance around their visible marker.
    let nearest = null;
    let closest = Infinity;
    for (const { mesh, button } of items) {
      if (button.hidden || button.disabled) continue;
      const rect = button.getBoundingClientRect();
      const distance = Math.hypot(event.clientX - rect.left - rect.width / 2,
        event.clientY - rect.top - rect.height / 2);
      if (distance <= rect.width / 2 + 8 && distance < closest) {
        closest = distance;
        nearest = mesh;
      }
    }
    return nearest;
  }
  const move = event => hover(pick(event), event);
  const leave = () => { cancelHover(); highlight(null); };
  const down = event => { cancelHover(); pointerDown = [event.clientX, event.clientY]; };
  const up = event => {
    const start = pointerDown;
    pointerDown = null;
    if (!start || Math.hypot(event.clientX - start[0], event.clientY - start[1]) > 6) return;
    const mesh = pick(event);
    const item = items.find(item => item.mesh === mesh);
    if (item) enter(item.entry);
  };
  const handlers = { pointermove: move, pointerleave: leave, pointerdown: down, pointerup: up, pointercancel: () => { pointerDown = null; leave(); } };
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
      cancelHover();
      for (const [event, handler] of Object.entries(handlers)) renderer.domElement.removeEventListener(event, handler);
      items.forEach(({ mesh, button }) => { scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); button.remove(); });
      renderer.domElement.style.cursor = '';
      hovered = null;
    },
  };
}
