# Legacy Spline/Trigger System Archive

This directory contains archived files from the original spline/trigger-based animation system, preserved for reference. These files were archived on November 9, 2025 as part of the transition to using Blender-exported GLB animations.

## Files

- `Spline.js` - Core spline implementation for defining and editing animation paths
- `Spline_Manager.js` - Manager for multiple spline instances with GUI controls
- `Trigger_manager.js` - Manages trigger volumes for animation events
- `TriggersSet.js` - Collection of trigger boxes positioned along splines

## Context

These files were part of the original BuildXR animation system that used programmatically defined splines and trigger volumes for assembly animations. The system was replaced by pre-authored Blender animations exported as GLB files, which provide better authoring workflow and more predictable playback.

## Note

This code is preserved for reference only and should not be used in new development. For current animation implementation, see:
- `AnimatedModelManager.js` - New GLB animation system
- `AssemblyManager.js` - New assembly sequence coordinator