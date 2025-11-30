// Archived on 2025-11-09
// Original file: scripts/TriggersSet.js
// Part of the legacy spline/trigger animation system

export class TriggersSet {
    constructor(THREE, scene, gui, name, spline) {
        if (!spline || !spline.curvesPath) {
            throw new Error("A valid Spline object must be provided to TriggersSet.");
        }
        this.THREE = THREE;
        this.scene = scene;
        this.gui = gui;
        this.spline = spline;
        this.guiFolder = null;
        this.name = name;

        // --- Data ---
        this.triggers = [];
        this.boxes = [];
        this.dimensions = new THREE.Vector3(0.9, 0.7, 0.05);

        // --- Visuals ---
        this.helpers = [];

        // --- State & GUI ---
        this.cursorBox = -1;
        this.guiProxy = {
            name: "",
            curveIndex: 0,
            t: 0
        };
        this.curveIndexController = null;
    }

    // Rest of the file contents...
    // [Original implementation preserved for reference]
}