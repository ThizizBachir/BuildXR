# BuildXR — WebXR 3D Visualization & Assembly Demo

**BuildXR** is a modern Progressive Web App (PWA) for WebXR-enabled 3D visualization, animation playback, and interactive assembly sequences. Built with Three.js, it delivers immersive XR experiences directly in the browser with offline-first capabilities via service workers.

## 📋 Table of Contents
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Core Components](#core-components)
- [Configuration](#configuration)
- [Running & Debugging](#running--debugging)
- [Deployment](#deployment)
- [Architecture & Concepts](#architecture--concepts)
- [Contributing](#contributing)

---

## ✨ Features

- **WebXR Support**: VR/AR-ready 3D scenes with native WebXR API integration
- **3D Model Animation**: Load and play GLTF/GLB models with skeletal animations
- **Assembly Sequences**: Step-by-step animated assembly workflows via configuration
- **Post-Processing Effects**: Outline rendering and visual effects through OutlineManager
- **Progressive Web App**: Installable on mobile, offline-capable via service worker
- **Live Scene Configuration**: JSON-based configuration for flexible scene setup
- **Debug UI**: Interactive lil-GUI controls for development and testing
- **Cross-Browser Compatible**: Optimized for Chromium-based browsers with WebXR support

---

## 🛠 Tech Stack

| Component | Technology |
|-----------|-----------|
| **3D Rendering** | Three.js (v0.177.0) |
| **Animation & Models** | GLTF/GLB, FBX via Three.js loaders |
| **UI Controls** | lil-GUI |
| **Computer Vision** | OpenCV.js |
| **PWA** | Service Worker, Web Manifest |
| **Web APIs** | WebXR, Fetch, Canvas |

---

## 🚀 Quick Start

### Prerequisites
- Node.js (for local development server) or Python 3
- A Chromium-based browser (Chrome, Edge, Brave) with WebXR support
- HTTPS or localhost for service worker & WebXR features

### Installation & Setup

1. **Clone or download the repository**:
   ```bash
   git clone https://github.com/ThizizBachir/BuildXR.git
   cd BuildXR
   ```

2. **Serve the `root/` folder locally**:
   
   **Option A: Node.js**
   ```bash
   npx http-server ./root -p 8080
   ```
   
   **Option B: Python 3**
   ```bash
   python -m http.server 8080 --directory root
   ```

3. **Open in your browser**:
   - Navigate to `http://localhost:8080/`
   - Accept the service worker registration prompt (if shown)
   - The app will be cached for offline use

4. **Test WebXR** (if hardware/browser supports it):
   - Click the **VR Button** (if visible in UI)
   - Put on your VR headset or use a compatible AR device

---

## 📁 Project Structure

```
BuildXR/
├── root/                              # Static web server root (deploy this)
│   ├── index.html                    # PWA entry point with manifest & SW registration
│   ├── sw.js                         # Service worker for caching & offline support
│   ├── xr-demo.webmanifest          # PWA manifest (name, icons, theme)
│   ├── scripts/                      # Main application code
│   │   ├── main.js                  # Bootstrap & initialization
│   │   ├── app.js                   # Application core (scene, renderer, camera setup)
│   │   ├── AssemblyManager.js       # Assembly sequence coordination
│   │   ├── AnimatedModelManager.js  # 3D model loading & animation playback
│   │   └── OutlineManager.js        # Post-processing effects (outlines)
│   ├── styles/
│   │   └── style.css                # UI & canvas styling
│   ├── jsons/                        # Configuration files
│   │   └── ConfigJson/
│   │       ├── AssemblyManager.json # Assembly sequence config (steps → clips)
│   │       └── ModelLoader.json     # Model loader config (currently empty)
│   ├── assets/                       # 3D models & textures
│   │   ├── drone.glb                # Example animated model
│   │   ├── cubemap/                 # Cubemap textures for skybox
│   │   └── [other models]
│   ├── certs/                        # SSL certificates (if needed for local HTTPS)
│   └── archive/                      # Legacy & experimental scripts
│       └── scripts/
│           ├── CameraPacingManager.js
│           ├── Following_Camera.js
│           ├── ModelLoader.js
│           ├── Navigator.js
│           ├── Spline.js
│           ├── Spline_Manager.js
│           ├── Trigger_manager.js
│           └── TriggersSet.js
├── .gitignore
└── README.md                         # This file
```

---

## 🎯 Core Components

### **app.js** — Application Core
Entry point for the 3D scene and application logic.

**Key responsibilities:**
- Scene, renderer, and camera setup
- Three.js utilities initialization (controls, loaders, lights)
- GUI panel creation (lil-GUI)
- Integration of managers: AssemblyManager, AnimatedModelManager, OutlineManager

**Key exports:**
```javascript
export class application
```

**Example usage:**
```javascript
import { application } from './app.js';
const app = new application();
```

---

### **AssemblyManager.js** — Assembly Sequences
Coordinates step-by-step assembly workflows using pre-authored animations.

**Key features:**
- Loads GLTF/GLB models with animation clips
- Reads assembly sequences from `AssemblyManager.json`
- Plays animation clips on demand (maps steps to clip names)
- Handles crossfading between animation clips
- Fallback cube with rotation animation if model loading fails

**Configuration structure** (`AssemblyManager.json`):
```json
{
    "sequence": [
        {
            "step": 0,
            "clip": "assembly_step_01",
            "crossfade": 0.3
        },
        {
            "step": 1,
            "clip": "assembly_step_02",
            "crossfade": 0.3
        }
    ]
}
```

**Key methods:**
- `initialize(modelConfigPath, assemblyConfigPath)` — Load config & model
- `startAssembly(step)` — Play animation from a step
- `nextStep()` — Advance to the next step
- `previousStep()` — Rewind to the previous step

---

### **AnimatedModelManager.js** — Model Loading & Animation
Handles GLTF/GLB model loading, animation mixing, and playback.

**Key features:**
- Async GLTF/GLB loading with Three.js GLTFLoader
- Animation mixer management for complex skeletal animations
- Play, pause, stop, and crossfade controls
- Fallback cube if model fails to load
- Debug UI integration (lil-GUI)

**Key methods:**
- `initialize(modelPath)` — Load a GLB/GLTF model
- `loadGLBFromAssets(modelPath)` — Fetch and parse model
- `playAnimation(clipName, loop, crossfadeDuration)` — Play a specific clip
- `stopAnimation(crossfadeDuration)` — Stop all animations

**Supported formats:**
- `.glb` (binary GLTF) — recommended for web
- `.gltf` with external assets

---

### **OutlineManager.js** — Post-Processing Effects
Applies outline rendering and visual effects to selected objects.

**Key features:**
- Outline effect using Three.js post-processing
- Per-object selection & highlighting
- Customizable outline width and color

**Use cases:**
- Highlight interactive parts during assembly
- Visual feedback on user interactions
- Special effects rendering

---

### **main.js** — Bootstrap & Initialization
Initializes the application and wires up all components.

**Key responsibilities:**
- App instantiation
- DOM setup
- Animation loop registration
- Event listeners (resize, input)

---

## ⚙️ Configuration

### Service Worker (`root/sw.js`)

The service worker enables offline functionality and asset caching.

**Cache strategy:**
- **Same-origin requests**: Cache-first (use cached, fall back to network)
- **Cross-origin requests**: Network-first (use network, fall back to cache)

**To force cache update during development:**

1. **Increment the cache name** in `sw.js`:
   ```javascript
   const CACHE_NAME = 'buildxr-v2'; // Was v1
   ```
   Then reload the page.

2. **Or manually unregister** via DevTools:
   - Open DevTools → Application → Service Workers
   - Click "Unregister"
   - Reload the page

**Precached assets** (defined in `sw.js`):
- HTML, CSS, main scripts
- Three.js library from CDN (may not be precached)

---

### Assembly & Model Configuration

**AssemblyManager.json**:
```json
{
    "sequence": [
        { "step": 0, "clip": "step_name", "crossfade": 0.3 },
        { "step": 1, "clip": "step_name_2", "crossfade": 0.5 }
    ]
}
```

**ModelLoader.json**:
- Currently empty; reserved for future model configuration
- Can specify default model paths, material overrides, etc.

---

## 🔍 Running & Debugging

### Local Development

**Start a development server:**
```bash
npx http-server ./root -p 8080
```

**Open DevTools for inspection:**
1. Press `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (macOS)
2. Check **Console** for errors and logs
3. Use **Network** tab to inspect asset loading
4. Use **Application** tab to inspect service worker and cache

### Debugging Tips

| Task | How |
|------|-----|
| **View logs** | Check browser Console for `console.log()` output |
| **Inspect scene** | Scene tree visible in Three.js DevTools extension (if installed) |
| **Clear service worker** | DevTools → Application → Service Workers → Unregister |
| **Force reload assets** | Hold `Shift` + click refresh, or `Ctrl+Shift+R` (Windows) |
| **Inspect cache** | DevTools → Application → Cache Storage → [CACHE_NAME] |
| **Check animation state** | Enable debug UI panel in lil-GUI (if configured) |

### Common Issues

| Issue | Solution |
|-------|----------|
| Service worker won't register | Must use HTTPS or localhost; check browser console |
| Models not loading | Check Network tab for 404s; verify asset paths in scripts |
| Stale resources (old CSS/JS) | Increment `CACHE_NAME` in `sw.js` or unregister service worker |
| WebXR not working | Use Chromium-based browser; some features need HTTPS |
| Animations not playing | Verify animation clip names match model exports |

---

## 📦 Deployment

### Static Hosting (Recommended)

Deploy the contents of `root/` to any static hosting provider:

1. **GitHub Pages** (free, tied to repository):
   ```bash
   # After pushing to main branch
   # Go to repo Settings → Pages → Deploy from main /root
   ```

2. **Netlify** (free tier, drag & drop):
   - Drag & drop the `root/` folder to Netlify
   - Custom domain available

3. **Vercel** (free, optimized for performance):
   - Connect GitHub repo
   - Set build root to `root/`

4. **AWS S3 + CloudFront**:
   - Upload `root/` contents to S3 bucket
   - Distribute via CloudFront for global CDN

### Pre-Deployment Checklist

- [ ] **HTTPS enabled** (required for WebXR & service worker)
- [ ] **PWA Manifest updated** (`xr-demo.webmanifest`):
  - Correct app name, description, icons
  - Icons at `icons/icon-192.png` and `icons/icon-512.png`
- [ ] **Service worker cache updated** (increment `CACHE_NAME` in `sw.js`)
- [ ] **All asset paths are correct** (use relative paths)
- [ ] **Models & textures included** in `assets/`
- [ ] **Configuration JSONs valid** (run through JSON validator)

---

## 🏗 Architecture & Concepts

### Three.js Scene Graph

```
Scene
├── Grid & Axes (helpers)
├── Lighting
├── Camera
└── Models
    ├── Animated models (AnimatedModelManager)
    ├── Parts (Assembly)
    └── UI elements (canvas overlays)
```

### Animation Pipeline

```
GLTF/GLB Model
    ↓
GLTFLoader (Three.js)
    ↓
AnimationMixer
    ↓
AnimationAction (play/pause/stop)
    ↓
AnimationClip (specific animation)
    ↓
Rendered Frame
```

### Assembly Workflow

```
AssemblyManager.json (config)
    ↓
Load clip names & timing
    ↓
Play animation on user action
    ↓
Monitor animation progress
    ↓
Trigger next step or callback
```

### WebXR Integration

- Three.js `WebXRManager` handles session setup
- `VRButton` widget (from Three.js WebXR) enables VR entry
- Camera perspective adapts to XR device
- Rendering handled automatically

---

## 🗂 Archive & Legacy Code

The `root/archive/scripts/` folder contains experimental and prior implementations:

- **CameraPacingManager.js** — Camera animation timing utilities
- **Following_Camera.js** — Third-person camera controller
- **Spline.js / Spline_Manager.js** — Curved path interpolation
- **Trigger_manager.js / TriggersSet.js** — Event trigger system
- **Navigator.js** — Scene navigation helpers

These are kept for reference but **not actively used**. New code should go in `root/scripts/`.

---

## 🤝 Contributing

We welcome contributions! Here's how:

### Reporting Issues
1. Open a GitHub issue describing the problem
2. Include:
   - Browser & OS version
   - Reproducible steps
   - Browser console errors (screenshot of DevTools)
   - Expected vs. actual behavior

### Submitting Code Changes
1. Fork the repository
2. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Make your changes following the code structure in `root/scripts/`
4. Test thoroughly in a local dev server
5. Submit a pull request with a clear description

### Code Guidelines
- **Module structure**: Use ES6 `export class` for new managers
- **Naming**: Use camelCase for functions/variables, PascalCase for classes
- **Comments**: Document class purposes and key methods with JSDoc
- **Files**: Keep each manager/utility as a separate file
- **Archives**: Move experimental code to `root/archive/scripts/` before archiving

---

## 📄 License

This project is open source. See the repository for license details.

---

## 🔗 Resources

- **Three.js Documentation**: https://threejs.org/docs/
- **WebXR Device API**: https://www.w3.org/TR/webxr/
- **lil-GUI**: https://github.com/georgealways/lil-gui
- **GLTF Spec**: https://www.khronos.org/gltf/
- **MDN Web Docs (WebXR)**: https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API
- **Service Workers**: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API

---

## ❓ FAQ

**Q: Can I use this on mobile?**
> Yes! BuildXR is a PWA and works on mobile browsers. Install it like an app via the browser menu. AR capabilities depend on device support.

**Q: What formats do models need to be in?**
> GLTF (`.gltf`) or GLB (`.glb`, binary GLTF) for best compatibility. FBX is also supported via FBXLoader but less recommended for web.

**Q: How do I add my own 3D model?**
> Place the model in `root/assets/`, then update `app.js` or `AssemblyManager.js` to load it. Update `AnimatedModelManager.json` or pass the path directly to `initialize()`.

**Q: Does this work without a service worker?**
> Yes, but you'll lose offline functionality. The app requires HTTPS or localhost for service worker registration. For development on `localhost`, both PWA and WebXR features work.

**Q: Can I use this for production?**
> Absolutely! Deploy to Netlify, Vercel, GitHub Pages, or your own server. Ensure HTTPS is enabled.

---

**Last Updated**: January 2026
**Maintained by**: ThizizBachir

## Known issues
- Service worker caching may serve stale JS/CSS after updates. See Service Worker section to resolve.
- WebXR support varies by browser and device — test on a Chromium-based browser with WebXR support.

## License
No license specified in this repository.

---