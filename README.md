# BuildXR — XR Web Demo

Project BuildXR is a small web XR demo and loader set. It delivers a static web experience with a service worker, example scenes, script utilities and configuration JSONs.

## Quick overview
- Purpose: demo and utilities for loading and navigating XR content in the browser.
- Serve the `root/` folder with a static HTTP server to run the demo (service worker requires HTTPS or localhost).
- Service worker is implemented at [`root/sw.js`](root/sw.js) and precaches core assets.


## How to run locally
1. From workspace root, serve the `root/` folder. Example commands:
   - Node: `npx http-server ./root -p 8080`
   - Python 3: `python -m http.server 8080 --directory root`
2. Open `http://localhost:8080/` in a Chromium-based browser for best WebXR support.
3. If a previously registered service worker causes stale caches, see "Service Worker" below.

## Service Worker
The service worker lives at [`root/sw.js`](root/sw.js). It uses a cache name constant [`CACHE_NAME`](root/sw.js) and precaches core assets listed in the `PRECACHE` array.
- To force update the cache during development:
  - Increment the cache name in [`root/sw.js`](root/sw.js) (e.g. `buildxr-v2`) and reload the page.
  - Or unregister the service worker from DevTools > Application > Service Workers.
- Fetch strategy: same-origin requests are served cache-first with network fallback; cross-origin requests use network-first with cache fallback. See [`root/sw.js`](root/sw.js) for details.

## Important files and roles
- [`root/index.html`](root/index.html) — entry HTML for the demo.
- [`root/scripts/main.js`](root/scripts/main.js) — bootstrap and initialization for the demo.
- [`root/scripts/app.js`](root/scripts/app.js) — application-level logic and scene wiring.
- [`root/scripts/AssemblyManager.js`](root/scripts/AssemblyManager.js) — assembly/config handling (see [`root/jsons/ConfigJson/AssemblyManager.json`](root/jsons/ConfigJson/AssemblyManager.json)).
- [`root/scripts/AnimatedModelManager.js`](root/scripts/AnimatedModelManager.js) — model animation utilities.
- [`root/scripts/OutlineManager.js`](root/scripts/OutlineManager.js) — outline rendering helper.
- Archive folder: [`root/archive/scripts/`](root/archive/scripts/) contains prior/experimental scripts retained for reference.

## Configuration
- JSON configuration is in [`root/jsons/ConfigJson/`](root/jsons/ConfigJson/):
  - [`AssemblyManager.json`](root/jsons/ConfigJson/AssemblyManager.json)
  - [`ModelLoader.json`](root/jsons/ConfigJson/ModelLoader.json)

## Development & debugging tips
- Use browser DevTools (Console, Network, Application) to inspect errors, network loading, and service worker caches.
- Keep the service worker disabled or update `CACHE_NAME` while iterating on JS/CSS to avoid stale resources.
- To inspect script entry points, start with [`root/scripts/main.js`](root/scripts/main.js) and [`root/scripts/app.js`](root/scripts/app.js).

## Deployment
- Deploy the contents of `root/` to a static hosting provider (GitHub Pages, Netlify, Vercel). Ensure HTTPS (required for WebXR and service worker).
- Update `xr-demo.webmanifest` (`root/xr-demo.webmanifest`) metadata as needed.

## Contributing
- Open issues describing reproducible steps.
- For code changes, follow the structure in [`root/scripts/`](root/scripts/) and keep archive files for reference only.

## Known issues
- Service worker caching may serve stale JS/CSS after updates. See Service Worker section to resolve.
- WebXR support varies by browser and device — test on a Chromium-based browser with WebXR support.

## License
No license specified in this repository.

---