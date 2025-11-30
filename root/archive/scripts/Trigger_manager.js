// Archived on 2025-11-09
// Original file: scripts/Trigger_manager.js
// Part of the legacy spline/trigger animation system

import { TriggersSet } from './TriggersSet.js';

export class TriggerManager {
    constructor(THREE, scene, gui, splineManager) {
        this.THREE = THREE;
        this.scene = scene;
        this.gui = gui;
        this.splineManager = splineManager;
        this.guiFolder = null;

        // --- Core Data Structures ---
        this.triggersMap = new Map();
        this.subscribers = new Map();
        this.nextTriggerIndex = new Map();

        // --- GUI State ---
        this.activeSetName = null;
        this.guiProxy = {
            activeSet: 'None',
            newSetName: 'NewSet',
            selectedSpline: 'None'
        };
        this.dropdownController = null;
        this.splineDropdownController = null;

        this.setupGUI();
    }

    // Rest of the file contents...
    // [Original implementation preserved for reference]
}