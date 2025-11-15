// Archived on 2025-11-09
// Original file: scripts/Spline.js
// Part of the legacy spline/trigger animation system

export class Spline {
    constructor(THREE, scene, gui, config = {},name) {
        this.THREE = THREE;
        this.scene = scene;
        this.gui = gui;
        this.guiFolder = null;
        this.name = name;

        // --- Configuration ---
        this.config = {
            mode: config.mode || 'XZ', // 'XZ', 'XY', 'YZ', 'XYZ'
            isClosed: config.isClosed || false,
            continuity: config.continuity || 'Full', // 'Full', 'Selective'
            globalOffset: config.globalOffset || 0
        };

        // --- Data ---
        this.points = [];
        this.cntrls = [];
        this.continuityFlags = []; // For 'Selective' continuity mode
        this.curvesPath = new this.THREE.CurvePath();
        
        // --- Visuals ---
        this.pointMeshes = [];
        this.cntrlMeshes = [];
        this.lineMeshes = [];
        
        // --- State & GUI ---
        this.cursorPt = 0;
        this.guiProxy = {
            anchor: { x: 0, y: 0, z: 0 },
            control: { x: 0, y: 0, z: 0 },
            isSmooth: true,
            nextCntrl : true, // Toggle between editing next (outgoing) or previous (incoming) control
        };

        this.isInitialized = false;
    }

    // Rest of the file contents...
    // [Original implementation preserved for reference]
}