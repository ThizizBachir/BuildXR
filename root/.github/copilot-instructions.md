## Quick context

- This is a small, static client-side XR demo served from `index.html`.
- Entry point: `index.html` loads `scripts/main.js` as an ES module; there is no Node build system or package.json in the repo root.
- Core JS lives in `scripts/` (e.g. `app.js`, `main.js`, `ModelLoader.js`, `Navigator.js`, `Spline_Manager.js`, `Trigger_manager.js`).

## What this project does (big picture)

- Creates a Three.js scene (see `scripts/app.js`) and drives a render loop in `scripts/main.js` with an FPS clamp pattern.
- Models and runtime data come from JSON configs (look for paths like `../jsons/ConfigJson/ModelLoader.json` referenced in `Navigator.js`).
- `ModelLoader` is responsible for loading FBX/GLTF/GLB assets and exposing `createInstance(name, options)` and debug controls (`addDebugControls`).

## Important architectural patterns for an AI agent to follow

- Files export classes named with PascalCase; each file typically contains one primary class (e.g. `application` in `app.js`, `ModelLoader` in `ModelLoader.js`, `Navigator` in `Navigator.js`).
- The project relies on runtime imports from CDN via an importmap in `index.html` (Three.js and lil-gui). Do not assume a bundler — code runs in modern browsers as ES modules.
- Runtime configuration is JSON-driven: to add or change models, update the JSON in the `jsons/ConfigJson` files referenced by the scripts. Example: `Navigator.initialize()` calls `ModelLoader.initialize("../jsons/ConfigJson/ModelLoader.json")`.

## Conventions and patterns to preserve when changing code

- Keep class-first structure and file-per-class naming (e.g. `ModelLoader.js` -> `ModelLoader` class).
- Use the existing Promise/async patterns: `ModelLoader.initialize()` loads assets and resolves a `ready` promise; other components await it before creating instances.
- Use `createInstance(name, options)` from `ModelLoader` rather than cloning raw loaded assets yourself — it applies consistent scale/position handling and works with the debug GUI.
- Preserve the FPS clamp in `main.js` (cap at 60 FPS) — changes to the render loop should maintain the same or better stability pattern.

## Debugging & developer workflows (how to run / common tasks)

- No npm install step required to open the demo. Serve the project root over a static server and open `index.html` in a modern browser that supports import maps and ES modules.

  Example (any static server):

  ```pwsh
  # From repo root (Windows PowerShell)
  # e.g. start a quick local server using your preferred tool (Five Server, Live Server, or python -m http.server)
  ```

- The repo contains a (currently empty) `sw.js` and `xr-demo.webmanifest` — be cautious when enabling a service worker during development; unregister stale SW in the browser devtools if behavior looks cached.

## Files to look at when changing behavior

- `index.html` — importmap and module entry. Modifying the importmap affects which CDN versions are used.
- `scripts/main.js` — main render loop and scroll event hookup (scroll -> `app.listen_to_Scroll`).
- `scripts/app.js` — scene, camera, renderer, GUI setup, and `construct_Loaders()` pattern.
- `scripts/ModelLoader.js` — asset loading, template registry, `createInstance()` and `addDebugControls()` (important for adding debug GUI entries).
- `scripts/Navigator.js` — coordinates `ModelLoader`, `Spline_Manager`, `Trigger_manager`, and camera/car composition; good example of wiring JSON-config modules together.

## Common edits an AI may be asked to do (examples)

- Add a new model: update `jsons/ConfigJson/ModelLoader.json` with the model path and then ensure `ModelLoader` supports the format (FBX/GLTF/GLB). Use `ModelLoader.createInstance("Name", {position, scale})` from `Navigator`.
- Expose a new debug GUI toggle: add a folder via `this.gui.addFolder()` in `app.js` or `ModelLoader.addDebugControls()`.
- Change render timing: modify the `FRAME_DURATION`/`MAX_FPS` constants in `main.js` and preserve the clamp logic.

## Edge cases and gotchas

- Because assets are loaded from relative JSON paths, file paths must be correct for the served root. When testing locally, serve from the repository root so `../jsons/...` resolves the same way as in production.
- The project expects modern browser features (import maps, ES module import of CDN URLs). Testing in older browsers will fail silently.
- Service worker (`sw.js`) is present but empty; enabling it without content can cause unexpected caching — unregister during development.

## If you need more info


If this looks good I can refine examples (add exact JSON keys from the ModelLoader config, list `jsons/` files, or add a short checklist for adding models). What should I add or clarify? 
If this looks good I can refine examples (add exact JSON keys from the ModelLoader config, list `jsons/` files, or add a short checklist for adding models).

## Project purpose (BuildXR) — user-provided context

BuildXR is an immersive assembly assistant that replaces paper manuals with step-by-step 3D instructions in XR. The intended user flow:

- A user scans a QR code on their smartphone, opens the static site, and, using Google Cardboard (or similar viewers), views an XR scene where 3D parts assemble step-by-step.
- The current repo contains scripts copied from an older spline/animation project. From those, the items that matter for BuildXR are:
  - Keep: `scripts/Spline.js`, `scripts/Spline_Manager.js`, `scripts/Trigger_manager.js`, `scripts/TriggersSet.js`, `scripts/ModelLoader.js`, and `scripts/app.js` (scene + renderer).
  - Replace/Delete: `scripts/Navigator.js` (legacy car/camera examples). The navigator can be removed and replaced with a small `AssemblyManager` module that orchestrates staged assembly using splines and triggers.

## WebXR integration notes (recommended)

- Target: smartphone + Google Cardboard. WebXR support varies by browser and device. The minimal, low-risk approach:
  1. Keep the importmap approach. Add the Three.js `XRButton` import in `index.html` from the same CDN (examples/jsm/webxr/XRButton.js).
  2. In `scripts/app.js`: enable VR on the renderer via `this.renderer.xr.enabled = true;` and call `document.body.appendChild( XRButton.createButton(this.renderer) );` (or equivalent when using the module import). This is the standard minimal path to allow entering an immersive session.
  3. Use `renderer.xr.isPresenting` checks to toggle UI/controls. For Google Cardboard you may need the `immersive-vr` session mode and to detect mobile device orientation fallback if session isn't available.
  4. If wide device compatibility is required (older Android/iOS browsers), consider adding a lightweight polyfill or fallback to an "inline" fullscreen mode where the camera is fixed to the device orientation.

Notes: I haven't changed code yet — I can implement a minimal XR enable/entry flow if you want. Cardboard often works with the standard WebXR Device API on modern Android Chrome; iOS Safari historically lacks WebXR so a fallback is needed.

## Suggested next steps (I can do these)

1. Update `.github/copilot-instructions.md` (done — this file) to include the BuildXR purpose and the keep/remove guidance. (current change)
2. Draft an `AssemblyManager` module that:
   - Imports `ModelLoader`, `Spline_Manager`, and `Trigger_manager`.
   - Exposes `initialize()` and `startAssembly(sequenceId)` to play staged assembly animations.
3. Add minimal WebXR wiring to `app.js` and `index.html` (requires your go-ahead).
4. Add explicit JSON schema examples for `ModelLoader.json` (I can read and extract those if you want).

## Questions for you

1. Do you want me to implement the minimal WebXR changes now (add XRButton + enable renderer.xr), or should I only draft the `AssemblyManager` without touching the render code?
2. Which devices/browsers must we support (Android Chrome only, iOS fallback needed, etc.)? That determines whether we need a polyfill/fallback.
3. Do you want `Navigator.js` deleted immediately, or should I create the new module and keep `Navigator.js` until the new module is verified?

Reply with answers to the three questions above and I'll proceed with the corresponding edits.
