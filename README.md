# ARC — interactive residences

A responsive architectural showcase inspired by the supplied fraxBIT TikTok reference. Built with Three.js and Vite. Includes two original GLB buildings, furnished rooms, editable finish presets, system/light/dark themes, orbit controls, scroll navigation, reduced-motion support, and asset validation.

## Run

Requires Node.js 20.19+ or 22.12+.

```sh
npm ci
npm run dev
npm run build
```

The production output is `dist/`. Serve it at the domain root on a static host. All models ship locally. Google Fonts requires an internet connection and falls back to system fonts.

## Change a building or interior

1. Open `public/properties/the-arc/property.json`.
2. Replace `exterior.glb` or `living.glb` with your exported GLB, or update the associated filename in JSON.
3. Set camera `position` and `target` as `[x,y,z]` in model coordinates. Use metres, Y up, ground at Y=0. The example exterior faces +Z.
4. Map finish presets to the exact material names in the room. The supplied rooms use `Floor`, `Walls`, `Upholstery`, and `Wood`.
5. Run `npm run validate`, then review framing and all finishes in the browser.

To add a property, duplicate a property folder, change its `id`, name and assets, and add the folder ID to `public/properties/index.json`. To add rooms, append entries to `rooms`. Each room needs an `id`, `name`, `model`, and `camera`. The room menu is populated automatically.

Keep editable Blender/CAD source separately. Export materials compatible with glTF PBR. Export a complete furnished interior separately from the exterior. Compress large models before delivery and preserve editable material names. The runtime currently supports standard uncompressed GLB assets. Draco/KTX2 assets need decoder setup before use. Review model scale, pivot, materials, lighting, and camera paths after every replacement.

`npm run assets` regenerates the original demonstration assets and manifests. It overwrites the two supplied property folders, so use it only when intentionally rebuilding those demos. Original procedural model source is in `scripts/generate-models.mjs`. These assets were authored for this project and have no third-party model dependencies.

## Themes and navigation

Theme choice persists locally and defaults to the system preference. UI theme changes the background and interface while keeping material illumination consistent. Drag to orbit. Scroll down over the 3D scene to enter, and up to return outside. Buttons provide the same actions on touchscreens and keyboards. Reset restores the configured camera. Reduced motion disables camera interpolation.

## Graphify

Graphify 0.9.103 was run locally using AST extraction. `graphify-out/graph.json` records the source relationships. CSS, binary assets and model material relationships are outside that graph. `npm run validate` checks model materials directly.

```sh
python -m venv .graphify-venv
# Windows
.graphify-venv/Scripts/python -m pip install graphifyy==0.9.103
.graphify-venv/Scripts/graphify update . --no-cluster
.graphify-venv/Scripts/graphify explain applyFinish
```

For renamed floor materials, inspect `applyFinish` in `src/main.js`, each affected property manifest, and `scripts/validate.mjs`. Refresh Graphify after source changes. `.graphifyignore` excludes dependencies, binaries, and generated builds. No global assistant hooks are installed.

## Verification and known limits

The production build validates both properties, GLB headers, camera vectors, unique IDs, finish colours and material bindings. Browser checks covered exterior/interior navigation, property replacement and finish controls, plus light and dark themes.

The supplied assets are stylized architectural models. The TikTok's photorealistic detailing and exact camera sequence are not reproduced. The tour switches between separate exterior and interior scenes with camera interpolation. Interior layout editing happens in the model source, while the interface provides finish presets. A WebGL failure currently shows a recovery message rather than a rendered image gallery. GLB load failures preserve the previous scene and offer retry. Mobile performance still depends on imported asset complexity and the device GPU.

## Interactive windows

Hover a marked front window to highlight its entry area and reveal the room label. Hold the mouse over its glass or arrow for 650 ms to enter. Moving away cancels entry. Clicking also enters immediately. Touch users tap the arrow, and keyboard users can Tab to it and press Enter. Dragging the model does not activate a window. Both demo entry points currently lead to the same living/dining room.

Each property's optional `entries` array defines window hotspots. Existing properties without entries retain the standard Interior button. Each entry contains a unique `id`, a `label`, a linked `room` ID, a world-coordinate `position`, positive box `size`, an exterior `approach` camera, and an `interiorEntry` camera. Cameras each contain `position` and `target` vectors. Place the interaction box slightly ahead of the window surface. Entry buttons are projected from the model coordinates and hidden when occluded by the building.

The destination GLB loads before camera movement. The camera approaches the selected window, fades between the separate models, then settles into the configured room view. Back outside reverses the sequence and restores the exterior angle before entry. Controls are locked during the transition, and reduced-motion mode uses a short fade. A failed load preserves the current scene and allows retry.

## Motion preference

Use the header's Tour motion selector. System follows the device motion preference. Animated tour enables the complete camera journey, including on a device requesting reduced motion. Reduced motion uses a gentle 180 ms fade and skips camera travel. Your selection is saved in this browser and survives reloads.
