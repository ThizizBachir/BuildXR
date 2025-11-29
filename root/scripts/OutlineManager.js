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
}
