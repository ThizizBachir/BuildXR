const loadAsset = (loader, path) => {
    return new Promise((resolve, reject) => {
        loader.load(path, resolve, undefined, reject);
    });
};

import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class ModelLoader {
    constructor(THREE, gui) {
        this.THREE = THREE;
        this.fbxLoader = new FBXLoader();
        this.gltfLoader = new GLTFLoader();
        this.templates = {};
        this.gui = gui;
        this.ModelPaths = {}; // Will be populated from JSON
    }

    /**
     * Asynchronously loads a master model configuration file and all associated assets.
     * @param {string} configUrl - The URL to the master JSON configuration for models.
     */
    async initialize(configUrl) {
        console.log(`ModelLoader: Initializing and loading assets from ${configUrl}...`);
        try {
            const response = await fetch(configUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            this.ModelPaths = await response.json();

            const modelNames = Object.keys(this.ModelPaths);
            const promises = modelNames.map(name => this._loadTemplate(name));
            
            await Promise.all(promises);
            console.log("ModelLoader: All assets loaded and ready! ✅");

        } catch (error) {
            console.error(`ModelLoader: A critical error occurred during initialization from ${configUrl}.`, error);
        }
    }

    async _loadTemplate(name) {
        const config = this.ModelPaths[name];
        const path = config.modelPath;
        let loader;

        // Determine which loader to use based on the file extension
        if (path.endsWith('.fbx')) {
            loader = this.fbxLoader;
        } else if (path.endsWith('.gltf') || path.endsWith('.glb')) {
            loader = this.gltfLoader;
        } else {
            console.error(`ModelLoader: Unsupported file format for "${name}". Path: ${path}`);
            return;
        }
        
        try {
            const asset = await loadAsset(loader, path);
            // GLTF loader returns an object with a 'scene' property, FBX returns the model directly.
            const model = asset.scene ? asset.scene : asset;
            this.templates[name] = model;
        } catch (error) {
            console.error(`ModelLoader: Failed to load asset "${name}" from path: ${path}`, error);
        }
    }

    createInstance(name, options = {}) {
        const template = this.templates[name];
        if (!template) {
            console.error(`ModelLoader: Template for "${name}" not found.`);
            return null;
        }

        const instance = template.clone();

        if (options.position) instance.position.set(options.position.x, options.position.y, options.position.z);
        if (options.rotation) instance.rotation.set(options.rotation.x, options.rotation.y, options.rotation.z);
        if (options.scale) instance.scale.set(options.scale.x, options.scale.y, options.scale.z);

        return instance;
    }

    addDebugControls(instance, name = 'Debug Object') {
        if (!this.gui) {
            console.warn("lil-gui instance not provided to ModelLoader. Cannot create debug controls.");
            return;
        }
        const folder = this.gui.addFolder(name);
        folder.add(instance.position, 'x', -40, 40, 0.001).name('Position X');
        folder.add(instance.position, 'y', -40, 40, 0.0001).name('Position Y');
        folder.add(instance.position, 'z', -40, 40, 0.0001).name('Position Z');
        folder.add(instance.rotation, 'x', -Math.PI, Math.PI, 0.01).name('Rotation X');
        folder.add(instance.rotation, 'y', -Math.PI, Math.PI, 0.01).name('Rotation Y');
        folder.add(instance.rotation, 'z', -Math.PI, Math.PI, 0.01).name('Rotation Z');
        const scaleFolder = folder.addFolder('Scale');
        scaleFolder.add(instance.scale, 'x', 0, 0.2, 0.0001).name('Scale X');
        scaleFolder.add(instance.scale, 'y', 0, 0.2, 0.0001).name('Scale Y');
        scaleFolder.add(instance.scale, 'z', 0, 0.2, 0.0001).name('Scale Z');
        const scaleHelper = { uniform: 1 };
        scaleFolder.add(scaleHelper, 'uniform', 0, 1, 0.0001).name('Uniform Scale').onChange(value => {
            instance.scale.set(value, value, value);
        });
        const actions = {
            logValues: () => {
                const pos = instance.position;
                const rot = instance.rotation;
                const scl = instance.scale;
                const optionsObject = {
                    position: `{ x: ${pos.x.toFixed(2)}, y: ${pos.y.toFixed(2)}, z: ${pos.z.toFixed(2)} }`,
                    rotation: `{ x: ${rot.x.toFixed(2)}, y: ${rot.y.toFixed(2)}, z: ${rot.z.toFixed(2)} }`,
                    scale: `{ x: ${scl.x.toFixed(2)}, y: ${scl.y.toFixed(2)}, z: ${scl.z.toFixed(2)} }`,
                };
                console.log(`📋 Values for '${name}':`);
                console.log(JSON.stringify(optionsObject, null, 2).replace(/"/g, ''));
            }
        };
        folder.add(actions, 'logValues').name('Log Values to Console');
        folder.open();
    }
}

