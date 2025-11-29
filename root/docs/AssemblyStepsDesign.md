# BuildXR Assembly Steps Design

This document outlines a modular, JSON-driven design to orchestrate step-based assembly for a multi-part GLB (e.g., a drone with 200+ meshes). It focuses on defining steps, outlining/blinking, hiding non-involved parts, centering the active elements, and staging for animation (without implementing animation code yet).

## Goals
- Select a step and highlight its involved meshes (outline + blink).
- Hide or fade non-involved meshes.
- Recenter active step elements toward a focal point smoothly.
- Stage-ready for simple axis translations/rotations per mesh later.
- Remain modular, testable, and JSON-configurable.

## Core Modules

- `AssemblyManager` (existing):
  - Role: Orchestrates steps (load config, select step, coordinate managers).
  - Responsibilities:
    - `initialize(configPath)`: Load `AssemblyManager.json` defining steps and mesh groupings.
    - `startStep(stepId)`: Resolve involved vs non-involved meshes; call managers.
    - `stopStep()`: Clear outlines, restore visibility/opacity/positions.
    - `getStepState()`: Expose current step metadata (for UI/debug).

- `ModelLoader` (existing):
  - Role: Provides access to loaded `Object3D` hierarchy. No changes needed.
  - Responsibilities: `ready` promise; `getByName(name)` or via `createInstance` if duplicating assets.

- `OutlineManager` (existing):
  - Role: Apply/remove outlines and blinking.
  - Responsibilities:
    - `apply(meshes, { color, blinking })`
    - `clear(meshes | all)`
    - `setBlinking(meshes, enabled, { freq })`

- `VisibilityManager` (new):
  - Role: Manage hide/fade states for non-involved meshes.
  - Responsibilities:
    - `hide(meshes)`: `visible = false` (fast path).
    - `fade(meshes, targetOpacity, { duration, easing })`: adjust `material.opacity` while `transparent=true` (defensive handling for multi-material).
    - `restore(meshes | all)`: restore baseline visibility/opacity.
  - Notes: When materials are shared, clone materials per mesh before fading to avoid side effects.

- `StagingManager` (new):
  - Role: Recenter/move involved meshes toward a focal point (without doing the assembly motion yet).
  - Responsibilities:
    - `stage(meshes, { toCenter, centerPoint, radius, duration })`: move toward `centerPoint` while preserving relative offsets.
    - `unstage(meshes | all)`: return to original transforms (tracked via per-mesh state snapshots).
  - Notes: Store original `position/rotation/scale` snapshot before staging.

- `StepStateStore` (new, lightweight):
  - Role: Track transient state for the active step.
  - Responsibilities:
    - Store original transforms, materials, visibility, and outline flags for involved and non-involved sets.
    - Provide `reset()` to restore scene.

## JSON Configuration (`jsons/ConfigJson/AssemblyManager.json`)

Suggested schema (extend current file as needed):

```json
{
  "steps": [
    {
      "id": "step-01",
      "label": "Attach Arms",
      "involvedMeshes": ["Arm_L", "Arm_R", "Screws_Set1"],
      "groups": [
        { "name": "Subassembly_Arms", "members": ["Arm_L", "Arm_R"], "moveTogether": true }
      ],
      "outline": {
        "color": "#00ffcc",
        "blinking": true,
        "blinkFreq": 2.0
      },
      "visibility": {
        "nonInvolved": "fade",
        "opacity": 0.15,
        "duration": 0.35
      },
      "staging": {
        "toCenter": true,
        "centerPoint": [0, 1.2, 0],
        "radius": 0.6,
        "duration": 0.5
      }
    }
  ]
}
```

- `involvedMeshes`: Names match GLB node names.
- `groups.moveTogether`: Indicates logical subassemblies to move as one in staging.
- `outline`: Visual emphasis parameters.
- `visibility.nonInvolved`: One of `hide` | `fade`.
- `staging`: Where to place elements for focus.

## Orchestration Flow (`AssemblyManager.startStep(stepId)`) 

1. Resolve involved vs non-involved:
   - Traverse `ModelLoader.root` and build sets.
2. Outline + blink involved:
   - `OutlineManager.apply(involved, config.outline)`.
3. Hide/fade non-involved:
   - If `fade`: `VisibilityManager.fade(nonInvolved, opacity, duration)`.
   - If `hide`: `VisibilityManager.hide(nonInvolved)`.
4. Stage involved to center:
   - `StagingManager.stage(involved, config.staging)`.
5. (Later) hand off to animation module for per-mesh axis motion.

`stopStep()`
- `StagingManager.unstage(all)`
- `OutlineManager.clear(all)`
- `VisibilityManager.restore(all)`
- `StepStateStore.reset()`

## Blinking Outline Behavior
- Use a per-step timer or render-loop hook controlled by `OutlineManager`.
- Toggle visibility/material/effect intensity at `blinkFreq` Hz.
- Keep the API independent from the main render loop; expose `update(dt)` called by `main.js` once per frame.

## Fading Notes
- Ensure `material.transparent = true` before opacity changes.
- For meshes sharing materials, clone once per mesh and track in `StepStateStore` for restore.
- If a mesh uses `MeshStandardMaterial` with `alphaTest` or `depthWrite` specifics, keep defaults unless artifacts appear; otherwise store/restore flags.

## Staging Strategy
- Compute centroid of involved meshes to preserve relative offsets.
- Move centroid to `centerPoint`; apply offset to each mesh = `targetCentroid - currentCentroid`.
- Optionally clamp movement within `radius` for camera framing.
- Store original transforms for precise unstage.

## Minimal Public APIs

- `AssemblyManager.initialize(configPath)` → Promise
- `AssemblyManager.startStep(stepId)`
- `AssemblyManager.stopStep()`
- `AssemblyManager.update(dt)` → call `OutlineManager.update(dt)`

- `VisibilityManager.fade(meshes, opacity, options)`
- `VisibilityManager.hide(meshes)`
- `VisibilityManager.restore(target)`

- `StagingManager.stage(meshes, options)`
- `StagingManager.unstage(target)`

- `OutlineManager.apply(meshes, options)`
- `OutlineManager.clear(target)`
- `OutlineManager.update(dt)`

## Integration Points
- `scripts/main.js`: call `assemblyManager.update(dt)` each frame.
- `scripts/app.js`: provide GUI toggles for `startStep/stopStep` and diagnostic displays of current step.
- `ModelLoader`: ensure consistent access to nodes by name; add a utility `getObjectByNameDeep(name)` if needed.

## Testing Checklist
- Step selection highlights only intended meshes.
- Non-involved meshes fade/hide reliably and restore correctly.
- Staging moves elements smoothly and returns to exact originals.
- Blinking respects `blinkFreq` and stops on `stopStep()`.
- JSON edits reflect runtime behavior without code changes.

## Future Animation Hook (Out of Scope Now)
- Add `MotionPlanner` later: axis-aligned translations/rotations per mesh.
- Accept simple declarative instructions in step JSON: `{ mesh: "Screw_A", type: "translate", axis: "Z", distance: 0.02 }`.

---
This design keeps your current architecture intact, adds focused managers for visibility and staging, and uses JSON to define steps. It avoids `AnimatedModelManager` and sets up clean handoffs for animation later.