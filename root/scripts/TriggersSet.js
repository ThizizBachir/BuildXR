/**
 * Manages a collection of trigger volumes that are procedurally
 * positioned along a Spline object.
 */
export class TriggersSet {
    constructor(THREE, scene, gui, name, spline) {
        if (!spline || !spline.curvesPath) {
            throw new Error("A valid Spline object must be provided to TriggersSet.");
        }
        this.THREE = THREE;
        this.scene = scene;
        this.gui = gui;
        this.spline = spline; // Reference to the master spline
        this.guiFolder = null;
        this.name = name;

        // --- Data ---
        // The source of truth is now an array of trigger data objects
        this.triggers = []; 
        this.boxes = []; // Array of THREE.Box3 for collision detection
        this.dimensions = new THREE.Vector3(0.9, 0.7, 0.05); // Standardized dimensions

        // --- Visuals ---
        this.helpers = []; // Array of THREE.LineSegments for visualization

        // --- State & GUI ---
        this.cursorBox = -1; 
        this.guiProxy = {
            name: "",
            curveIndex: 0,
            t: 0
        };
        this.curveIndexController = null;
    }

    /**
     * Adds a new trigger box. If a box is selected, it duplicates its properties.
     * Otherwise, it creates a default box at the start of the spline.
     */
    addBox() {
        let newTriggerData;
        if (this.cursorBox > -1 && this.triggers[this.cursorBox]) {
            // Duplicate the currently selected trigger
            const currentTrigger = this.triggers[this.cursorBox];
            newTriggerData = { 
                name: `${currentTrigger.name}_copy`,
                curveIndex: currentTrigger.curveIndex,
                t: Math.min(currentTrigger.t +0.2,1)
            };
        } else {
            // Create a default trigger at the start of the spline
            newTriggerData = {
                name: 'box_0',
                curveIndex: 0,
                t: 0
            };
        }
        
        const newIndex = this.triggers.length;
        this.triggers.push(newTriggerData);

        // Create corresponding data and visual objects
        this.boxes.push(new this.THREE.Box3());
        const geometry = new this.THREE.BoxGeometry(1, 1, 1);
        const edges = new this.THREE.EdgesGeometry(geometry);
        const helper = new this.THREE.LineSegments(edges, new this.THREE.LineBasicMaterial({ color: 0xff00ff }));
        this.helpers.push(helper);
        this.scene.add(helper);
        
        this.cursorBox = newIndex; // Select the new box

        this._updateBox(this.cursorBox);
        this.updateVisuals();
        this._updateGUIProxy();
    }
    
    deleteBox() {
        if (this.cursorBox === -1 || !this.helpers.length) return;

        // Remove from scene and dispose of resources
        const helper = this.helpers[this.cursorBox];
        this.scene.remove(helper);
        helper.geometry.dispose();
        helper.material.dispose();

        // Remove from all arrays
        this.triggers.splice(this.cursorBox, 1);
        this.boxes.splice(this.cursorBox, 1);
        this.helpers.splice(this.cursorBox, 1);
        
        // Adjust cursor to a valid index
        if (this.cursorBox >= this.triggers.length) {
            this.cursorBox = this.triggers.length - 1;
        }

        this.updateVisuals();
        this._updateGUIProxy();
    }

    /**
     * Updates a single box's data (Box3) and visuals based on its spline position.
     * @param {number} index The index of the trigger to update.
     */
    _updateBox(index) {
        if (index < 0 || index >= this.triggers.length) return;

        const trigger = this.triggers[index];
        const box = this.boxes[index];
        const helper = this.helpers[index];

        // 1. Calculate World Position from Spline Data
        const curve = this.spline.curvesPath.curves[trigger.curveIndex];
        if (!curve) return; // Safety check
        const center = curve.getPointAt(trigger.t);
        const tangent = curve.getTangentAt(trigger.t);
        
        // 2. Update Visual Helper
        helper.position.copy(center);
        helper.scale.copy(this.dimensions);
        // Orient the helper to face along the spline's tangent (always Z orientation)
        helper.quaternion.setFromUnitVectors(new this.THREE.Vector3(0,0,1), tangent);

        // 3. Update Axis-Aligned Bounding Box for Collision
        box.setFromCenterAndSize(center, this.dimensions);
    }

    _updateAllBoxes() {
        for (let i = 0; i < this.triggers.length; i++) {
            this._updateBox(i);
        }
    }

    updateVisuals() {
        this.helpers.forEach((helper, index) => {
            helper.material.color.set(index === this.cursorBox ? 0xff0000 : 0xff00ff);
        });
    }

    /**
     * Sorts triggers by curve index first, then by t value within the same curve
     */
    sort() {
        // Create array of indices with their corresponding trigger data
        const indexedTriggers = this.triggers.map((trigger, index) => ({
            trigger,
            originalIndex: index
        }));

        // Sort by curveIndex first, then by t value
        indexedTriggers.sort((a, b) => {
            if (a.trigger.curveIndex !== b.trigger.curveIndex) {
                return a.trigger.curveIndex - b.trigger.curveIndex;
            }
            return a.trigger.t - b.trigger.t;
        });

        // Reorder all arrays based on the sorted indices
        const newTriggers = [];
        const newBoxes = [];
        const newHelpers = [];
        let newCursorBox = -1;

        indexedTriggers.forEach((item, newIndex) => {
            const oldIndex = item.originalIndex;
            newTriggers.push(this.triggers[oldIndex]);
            newBoxes.push(this.boxes[oldIndex]);
            newHelpers.push(this.helpers[oldIndex]);
            
            // Update cursor position if it was pointing to this trigger
            if (this.cursorBox === oldIndex) {
                newCursorBox = newIndex;
            }
        });

        // Replace the arrays with sorted versions
        this.triggers = newTriggers;
        this.boxes = newBoxes;
        this.helpers = newHelpers;
        this.cursorBox = newCursorBox;

        this.updateVisuals();
        this._updateGUIProxy();
    }

    // --- GUI Methods ---
    setupGUI() {
        if (this.guiFolder) this.guiFolder.destroy();
        this.guiFolder = this.gui.addFolder(this.name);

        // Editor for the currently selected trigger
        const editorFolder = this.guiFolder.addFolder('Selected Trigger Editor');
        editorFolder.add(this.guiProxy, 'name').name('Name').listen().onChange(v => {
            if (this.cursorBox > -1) this.triggers[this.cursorBox].name = v;
        });
        this.curveIndexController = editorFolder.add(this.guiProxy, 'curveIndex').name('Curve Index').listen().disable();
        editorFolder.add(this, '_prevCurve').name('< Prev Curve');
        editorFolder.add(this, '_nextCurve').name('Next Curve >');
        editorFolder.add(this.guiProxy, 't', 0, 1, 0.001).name('Position on Curve (t)').listen().onChange(v => {
            if (this.cursorBox > -1) {
                this.triggers[this.cursorBox].t = v;
                this._updateBox(this.cursorBox);
            }
        });

        // Management for the array of triggers
        const manageFolder = this.guiFolder.addFolder('Trigger Management');
        manageFolder.add(this, '_prevBox').name('< Previous Trigger');
        manageFolder.add(this, '_nextBox').name('Next Trigger >');
        manageFolder.add(this, 'addBox').name('Add Trigger');
        manageFolder.add(this, 'deleteBox').name('Delete Selected Trigger');
        manageFolder.add(this, 'sort').name('Sort Triggers');

        // File I/O
        const fileFolder = this.guiFolder.addFolder('File');
        fileFolder.add(this, '_saveToFile').name('Save to JSON');
        fileFolder.add(this, '_loadFromFile').name('Load from JSON');
        
        this.guiFolder.open();
    }
    
    _prevCurve() { this._moveCurve(-1); }
    _nextCurve() { this._moveCurve(1); }
    _moveCurve(direction) {
        if (this.cursorBox > -1) {
            const numCurves = this.spline.curvesPath.curves.length;
            const trigger = this.triggers[this.cursorBox];
            trigger.curveIndex = (trigger.curveIndex + direction + numCurves) % numCurves;
            this._updateBox(this.cursorBox);
            this._updateGUIProxy();
        }
    }

    _prevBox() { this._moveBox(-1); }
    _nextBox() { this._moveBox(1); }
    _moveBox(direction) {
        if (!this.helpers.length) return;
        this.cursorBox = (this.cursorBox + direction + this.helpers.length) % this.helpers.length;
        this.updateVisuals();
        this._updateGUIProxy();
    }

    _updateGUIProxy() {
        if (this.cursorBox > -1 && this.triggers[this.cursorBox]) {
            const trigger = this.triggers[this.cursorBox];
            this.guiProxy.name = trigger.name;
            this.guiProxy.curveIndex = trigger.curveIndex;
            this.guiProxy.t = trigger.t;
        } else {
            this.guiProxy.name = "";
            this.guiProxy.curveIndex = 0;
            this.guiProxy.t = 0;
        }
    }

    // --- Data Management ---
    toJSON() {
        return {
            triggers: this.triggers
        };
    }
    
    clear() {
        this.helpers.forEach(h => { this.scene.remove(h); h.geometry.dispose(); h.material.dispose(); });
        this.triggers = [];
        this.boxes = [];
        this.helpers = [];
        this.cursorBox = -1;
    }

    rebuildFromJSON(jsonString) {
        const data = JSON.parse(jsonString);
        if (!data.triggers) {
            alert("Invalid spline trigger data format."); return;
        }

        this.clear();
        this.triggers = data.triggers;

        this.triggers.forEach((trigger, index) => {
            this.boxes.push(new this.THREE.Box3());
            const geometry = new this.THREE.BoxGeometry(1, 1, 1);
            const edges = new this.THREE.EdgesGeometry(geometry);
            const helper = new this.THREE.LineSegments(edges, new this.THREE.LineBasicMaterial({ color: 0xff00ff }));
            this.helpers.push(helper);
            this.scene.add(helper);
        });
        
        if (this.triggers.length > 0) {
            this.cursorBox = 0;
        }

        this._updateAllBoxes();
        this.updateVisuals();
        this._updateGUIProxy();
    }

    _saveToFile() {
        // Sort before saving
        this.sort();
        
        const data = this.toJSON();
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.name + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    _loadFromFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = event => {
                try { this.rebuildFromJSON(event.target.result); }
                catch (err) {
                    console.error("Error reading/parsing JSON:", err);
                    alert("Failed to load box triggers. Check console.");
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }
    
    async loadFromURL(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const jsonString = await response.text();
            this.rebuildFromJSON(jsonString);
        } catch (error) {
            console.error(`Failed to load box triggers from URL: ${url}`, error);
            alert(`Failed to load box triggers. Check console.`);
        }
    }
}