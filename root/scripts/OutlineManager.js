import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import * as THREE from 'three';

/**
 * Manages the Three.js post-processing pipeline for an outline effect.
 */
export class OutlineManager {
    constructor(scene, camera, renderer, gui) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.gui = gui;
        this.selectedObjects = [];

        // Blinking state
        this.isBlinking = false;
        this.blinkFreq = 2.0; // Hz
        this.blinkTimer = 0;
        this.blinkVisible = true;

        // Mesh name index (base -> [variants])
        this._meshIndexBuilt = false;
        this._meshIndex = new Map();

        this._setupComposer();
        this._setupOutlinePass();
        if (this.gui) {
            // this.setupOutlineGUI();
        }

        window.addEventListener('resize', this.onWindowResize.bind(this));
    }

    _setupComposer() {
        this.composer = new EffectComposer(this.renderer);
        this.composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.composer.setSize(window.innerWidth, window.innerHeight);

        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);
    }

    /**
     * Build an index of mesh name bases to numbered variants.
     * Example: camera_1,camera_2 -> base 'camera' => ['camera_1','camera_2'].
     * Also stores exact names for direct lookup.
     * @param {THREE.Object3D} root
     */
    _buildMeshIndex(root){
        if (this._meshIndexBuilt) return;
        const numberSuffixRegex = /^(.*)_([0-9]+)$/;
        root.traverse(child => {
            if (!child.isMesh) return;
            const name = child.name;
            const match = name.match(numberSuffixRegex);
            if (match){
                const base = match[1];
                if (!this._meshIndex.has(base)) this._meshIndex.set(base, { numbered: [], exact: false });
                this._meshIndex.get(base).numbered.push(name);
            } else {
                // Track presence of exact (non-numbered) names
                if (!this._meshIndex.has(name)) this._meshIndex.set(name, { numbered: [], exact: true });
                else this._meshIndex.get(name).exact = true;
            }
        });
        // Sort numbered arrays numerically
        for (const [base, data] of this._meshIndex.entries()){
            data.numbered.sort((a,b) => {
                const ai = parseInt(a.substring(base.length+1));
                const bi = parseInt(b.substring(base.length+1));
                return ai - bi;
            });
        }
        this._meshIndexBuilt = true;
    }

    /**
     * Expand a list of base names to actual mesh objects (including numbered variants).
     * @param {THREE.Object3D} root
     * @param {string[]} baseNames
     * @returns {THREE.Object3D[]} matched meshes
     */
    _expandBaseNames(root, baseNames){
        this._buildMeshIndex(root);
        const found = [];
        const nameSet = new Map(); // avoid duplicates
        const collectByName = (targetName) => {
            root.traverse(child => {
                if (child.isMesh && child.name === targetName && !nameSet.has(targetName)){
                    found.push(child);
                    nameSet.set(targetName, true);
                }
            });
        };
        baseNames.forEach(base => {
            const entry = this._meshIndex.get(base);
            if (entry){
                // Add exact base if present
                if (entry.exact) collectByName(base);
                // Add numbered variants
                entry.numbered.forEach(n => collectByName(n));
            } else {
                // Fallback: try direct match only
                collectByName(base);
            }
        });
        return found;
    }

    _setupOutlinePass() {
        const size = this.renderer.getSize(new THREE.Vector2());
        this.outlinePass = new OutlinePass(size, this.scene, this.camera);

        // Configuration for the outline effect
        this.outlinePass.edgeStrength = 1.71;
        this.outlinePass.edgeGlow = 0.774;
        this.outlinePass.edgeThickness = 1.5;
        this.outlinePass.pulsePeriod = 0;
        // Lemon greenish outline color (R=7, G=207, B=31)
        this.outlinePass.visibleEdgeColor.setRGB(7/255, 207/255, 31/255);
        this.outlinePass.hiddenEdgeColor.set('#190a05');
        
        this.composer.addPass(this.outlinePass);

        // Dynamic passes disabled (single color mode)
        this.dynamicOutlinePasses = [];
    }

    /**
     * Sets the objects to be outlined.
     * @param {THREE.Object3D[]} objects - An array of objects to outline.
     */
    setSelectedObjects(objects) {
        this.outlinePass.selectedObjects = objects;
    }

    /**
     * Selectively outline meshes from a model based on a filter function.
     * @param {THREE.Object3D} model - The model to traverse
     * @param {Function} filterFn - Optional filter function. Receives (mesh) and returns true to include.
     *                              If not provided, all meshes are included.
     * @example
     * // Outline only meshes with 'wing' in their name
     * outlineManager.setSelectiveMeshes(model, (mesh) => mesh.name.includes('wing'));
     */
    setSelectiveMeshes(model, filterFn = null) {
        const selectableObjects = [];
        model.traverse((child) => {
            if (child.isMesh) {
                if (!filterFn || filterFn(child)) {
                    selectableObjects.push(child);
                }
            }
        });
        this.setSelectedObjects(selectableObjects);
        console.log(`OutlineManager: Selected ${selectableObjects.length} meshes for outline`);
        return selectableObjects;
    }

    /**
     * Update blinking timer (call each frame)
     * @param {number} deltaTime - Time since last frame in seconds
     */
    update(deltaTime) {
        if (!this.isBlinking) return;

        this.blinkTimer += deltaTime;
        const period = 1.0 / this.blinkFreq;
        if (this.blinkTimer >= period / 2) {
            this.blinkTimer = 0;
            this.blinkVisible = !this.blinkVisible;
            // Toggle outline visibility by swapping selected objects
            this.outlinePass.selectedObjects = this.blinkVisible ? this.selectedObjects : [];
        }
    }

    /**
     * Enable or disable blinking for selected objects
     * @param {boolean} enabled - Whether to blink
     * @param {number} freq - Blink frequency in Hz (default 2.0)
     */
    setBlinking(enabled, freq = 2.0) {
        this.isBlinking = enabled;
        this.blinkFreq = freq;
        this.blinkTimer = 0;
        this.blinkVisible = true;
        if (!enabled) {
            // Restore full visibility
            this.outlinePass.selectedObjects = this.selectedObjects;
        }
    }

    /**
     * Clear all outlines and stop blinking
     */
    clear() {
        this.selectedObjects = [];
        this.outlinePass.selectedObjects = [];
        this.isBlinking = false;
        this.blinkTimer = 0;
        this.blinkVisible = true;

        // Ensure no dynamic passes remain
        if (this.dynamicOutlinePasses.length) {
            this.dynamicOutlinePasses.forEach(p => {
                const idx = this.composer.passes.indexOf(p);
                if (idx !== -1) this.composer.passes.splice(idx, 1);
            });
            this.dynamicOutlinePasses = [];
        }
    }

    /**
     * Renders the scene with the outline effect.
     * Call this in your main animation loop instead of renderer.render().
     */
    render() {
        this.composer.render();
    }

    /**
     * Handles window resize events to keep the composer and camera updated.
     */
    onWindowResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height);
        this.composer.setSize(width, height);
    }

    /**
     * Sets up a lil-gui folder for controlling outline properties.
     */
    setupOutlineGUI() {
        const outlineFolder = this.gui.addFolder('Outline Effect');
        outlineFolder.add(this.outlinePass, 'edgeStrength', 0, 10).name('Edge Strength');
        outlineFolder.add(this.outlinePass, 'edgeGlow', 0, 1).name('Edge Glow');
        outlineFolder.add(this.outlinePass, 'edgeThickness', 1, 4).name('Edge Thickness');
        
        const visibleColor = { color: `#${this.outlinePass.visibleEdgeColor.getHexString()}` };
        const hiddenColor = { color: `#${this.outlinePass.hiddenEdgeColor.getHexString()}` };
        
        outlineFolder.addColor(visibleColor, 'color')
            .name('Visible Edge')
            .onChange(value => this.outlinePass.visibleEdgeColor.set(value));
        
        outlineFolder.addColor(hiddenColor, 'color')
            .name('Hidden Edge')
            .onChange(value => this.outlinePass.hiddenEdgeColor.set(value));
    }

    /**
     * Setup step outline buttons (8 buttons for step 1-8)
     * @param {Object3D} droneModel - The loaded drone model to search for meshes
     * @param {Object} assemblyConfig - The parsed AssemblyManager.json config
     * @param {MeshGroupLoader} meshGroupLoader - Optional group loader for logical names
     */
    setupStepButtons(droneModel, assemblyConfig, meshGroupLoader = null) {
        if (!this.gui) return;

        const stepsFolder = this.gui.addFolder('Assembly Steps');
        
        // Create buttons for steps 1-8
        for (let i = 1; i <= 8; i++) {
            const stepId = `step-0${i}`;
            const step = assemblyConfig.steps.find(s => s.id === stepId);
            
            const controls = {
                [`outlineStep${i}`]: () => {
                    if (!step) {
                        console.warn(`Step ${stepId} not found in config`);
                        return;
                    }

                    // Expand base names to numbered variants or use group loader
                    let meshes = [];
                    const debugCounts = [];
                    if (meshGroupLoader) {
                        // Try to resolve logical names via group loader first
                        step.involvedMeshes.forEach(name => {
                            // Check baseName groups
                            const groupMeshes = meshGroupLoader.getMeshes(name);
                            if (groupMeshes) {
                                meshes.push(...groupMeshes);
                                debugCounts.push({ name, type: 'base-group', count: groupMeshes.length });
                            } else {
                                // Check assembled groups
                                const assembledMeshes = meshGroupLoader.getAssembledGroupMeshes(name);
                                if (assembledMeshes) {
                                    meshes.push(...assembledMeshes);
                                    debugCounts.push({ name, type: 'assembled-group', count: assembledMeshes.length });
                                } else {
                                    // Fallback: expand base name directly
                                    const direct = this._expandBaseNames(droneModel, [name]);
                                    meshes.push(...direct);
                                    debugCounts.push({ name, type: 'direct', count: direct.length });
                                }
                            }
                        });
                    } else {
                        // No group loader: use direct expansion
                        meshes = this._expandBaseNames(droneModel, step.involvedMeshes);
                        step.involvedMeshes.forEach(name => {
                            const direct = this._expandBaseNames(droneModel, [name]);
                            debugCounts.push({ name, type: 'direct', count: direct.length });
                        });
                    }

                    if (meshes.length === 0) {
                        console.warn(`No meshes found for step ${stepId}. Check mesh names or prefixes.`);
                        console.table(debugCounts);
                        return;
                    }
                    console.table(debugCounts);

                    // Set outline color from config if available
                    if (step.outline && step.outline.color) {
                        this.outlinePass.visibleEdgeColor.set(step.outline.color);
                    }

                    // Apply single-color outline to all selected meshes
                    this.applySingleColorOutline(meshes, step.outline?.color);
                    // Enable blinking if requested
                    const blinkFreq = step.outline?.blinkFreq || 2.0;
                    const blinking = step.outline?.blinking !== false;
                    this.setBlinking(blinking, blinkFreq);

                    console.log(`OutlineManager: Step ${i} - outlined ${meshes.length} meshes`);
                }
            };

            const label = step ? step.label : `Step ${i}`;
            stepsFolder.add(controls, `outlineStep${i}`).name(`Outline ${label}`);
        }

        // Add a clear button
        const clearControls = {
            clearOutline: () => this.clear()
        };
        stepsFolder.add(clearControls, 'clearOutline').name('Clear Outline');
    }

    /**
     * Apply single color outline using the base OutlinePass.
     * @param {THREE.Object3D[]} meshes
     * @param {string|THREE.Color} color Optional color to set
     */
    applySingleColorOutline(meshes, color){
        // Remove any dynamic passes if present
        if (this.dynamicOutlinePasses.length) {
            this.dynamicOutlinePasses.forEach(p => {
                const idx = this.composer.passes.indexOf(p);
                if (idx !== -1) this.composer.passes.splice(idx, 1);
            });
            this.dynamicOutlinePasses = [];
        }

        // Assign selection to base pass
        this.selectedObjects = meshes.slice();
        this.outlinePass.selectedObjects = this.selectedObjects;

        // Apply provided color if given
        if (color) {
            if (typeof color === 'string') {
                this.outlinePass.visibleEdgeColor.set(color);
            } else if (color instanceof THREE.Color) {
                this.outlinePass.visibleEdgeColor.copy(color);
            }
        }
    }
}
