import { Spline } from './Spline.js'; // Ensure this path is correct for your project structure
import { TransformControls } from 'three/addons/controls/TransformControls.js';

export class SplineManager {
    constructor(THREE, scene, gui) {
        this.THREE = THREE;
        this.scene = scene;
        this.gui = gui;
        this.guiFolder = null;

        // --- Core Data Structures ---
        this.splines = new Map(); // Stores all Spline instances, keyed by name


        
        // --- Gizmo & Interaction ---
        this.camera = null;
        this.controls = null;
        this.rendererEl = null;
        this.transformControls = null;
        this.raycaster = new this.THREE.Raycaster();
        this.mouse = new this.THREE.Vector2();

        // --- GUI State ---
        this.activeSplineName = null; // The name of the spline currently being edited
        this.guiProxy = {
            activeSpline: 'None'
        };
        this.dropdownController = null;

        this.setupGUI();
    }

    /**
     * Initialize the SplineManager by loading all splines from a configuration file.
     * @param {string} configPath - Path to the JSON configuration file containing spline definitions.
     * @returns {Promise<void>} A promise that resolves when all splines are loaded.
     */
        async initialize(configPath, camera, rendererEl,controls) {
        this.camera = camera;
        this.controls = controls;
        this.rendererEl = rendererEl;

        try {
            const response = await fetch(configPath);
            if (!response.ok) throw new Error(`Fetch error: ${response.statusText}`);
            const splineConfigs = await response.json();

            const loadPromises = splineConfigs.map(config => {
                // Pass camera and rendererEl down to each spline
                return this.load(config.name, config.path, camera, rendererEl);
            });
            await Promise.all(loadPromises);
            console.log(`SplineManager: Initialized with ${this.splines.size} splines`);
        } catch (error) {
            console.error('SplineManager: Failed to initialize from config:', error);
            throw error;
        }

        this._initializeGizmoAndInteraction();
    }

    /**
     * Sets up the single TransformControls gizmo and the raycasting interaction.
     */
    _initializeGizmoAndInteraction() {
        if (!this.camera || !this.rendererEl) {
            console.error("SplineManager: Camera or Renderer Element not provided. Gizmo disabled.");
            return;
        }
        
        // 1. Create the single gizmo and raycaster
        this.transformControls = new TransformControls(this.camera, this.rendererEl);
        this.scene.add(this.transformControls.getHelper());


        // 2. Add event listeners for interaction
        this.rendererEl.addEventListener('mousedown', this._onMouseDown.bind(this));

        this.transformControls.addEventListener('dragging-changed', (event) => {
            if (this.controls) this.controls.enabled = !event.value;
        });

        this.transformControls.addEventListener('objectChange', () => {
            this._updateSplineDataFromGizmo();
        });
    }

    /**
     * Handles the middle-mouse-button press to select and attach the gizmo.
     */
    _onMouseDown(event) {
        // Only trigger on middle mouse button press
        if (event.button !== 1) return;

        event.preventDefault();

        // Calculate normalized mouse coordinates
        this.mouse.x = (event.clientX / this.rendererEl.clientWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / this.rendererEl.clientHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        const allMeshes = this._getAllInteractableMeshes();
        const intersects = this.raycaster.intersectObjects(allMeshes);

        if (intersects.length > 0) {
            // The first object is the closest one
            const targetMesh = intersects[0].object;
            this.transformControls.attach(targetMesh);
            console.log(targetMesh);
            
            // Also update the GUI to show the spline we're editing
            if (targetMesh.userData.spline) {
                this._setActiveSpline(targetMesh.userData.spline.name);
            }

        } else {
            // Clicked on empty space, detach the gizmo
            this.transformControls.detach();
        }
    }

    /**
     * Called when the gizmo moves an object; it updates the underlying spline data.
     */
    _updateSplineDataFromGizmo() {
        if (!this.transformControls.object) return;

        const activeMesh = this.transformControls.object;
        const { spline, type, index } = activeMesh.userData;

        if (!spline){
            console.warn("no spline")
            return;
        } 
            

        if (type === 'anchor') {
            const deltaPos = new this.THREE.Vector3().copy(activeMesh.position).sub(spline.points[index]);

            spline.points[index].copy(activeMesh.position);

            const outgoingIndex = index * 2;
            const incomingIndex = (index * 2 - 1 + spline.cntrls.length) % spline.cntrls.length;
            // console.log(spline.cntrls[outgoingIndex])
            // console.log(outgoingIndex)
             if (spline.cntrls[outgoingIndex]) {
                spline.cntrls[outgoingIndex].add(deltaPos);
            }
            if (spline.cntrls[incomingIndex]) {
                spline.cntrls[incomingIndex].add(deltaPos);
            }
            // spline._updateContinuity(outgoingIndex);
            // spline._updateContinuity(incomingIndex);
        } else if (type === 'control') {
            console.log("hello")
            spline.cntrls[index].copy(activeMesh.position);
            spline._updateContinuity(index);
        }

        spline.updateVisuals();
        spline._updateGUIProxy();
    }
    
    _getAllInteractableMeshes() {
        let meshes = [];
        for (const spline of this.splines.values()) {
            meshes = meshes.concat(spline.pointMeshes, spline.cntrlMeshes);
        }
        return meshes;
    }

    /**
     * Factory method to create a new Spline instance based on a configuration.
     * @param {string} name - A unique name for this spline.
     * @param {object} config - The configuration object for the new Spline.
     * @returns {Promise<Spline>} A promise that resolves with the fully initialized Spline instance.
     */
    async create(name, config) {
        if (this.splines.has(name)) {
            console.warn(`SplineManager: A spline named '${name}' already exists.`);
            return this.splines.get(name);
        }

        // Each spline gets its own GUI folder, managed by the manager
        const splineGUIFolder = this.gui.addFolder(name);
        splineGUIFolder.close(); // Hide by default

        const spline = new Spline(this.THREE, this.scene, splineGUIFolder, config);
        await spline.initialize(null , this.camera,this.canva); // Initialize with default points based on config

        this.splines.set(name, spline);
        this._updateGUIDropdown();
        this._setActiveSpline(name);

        return spline;
    }

    /**
     * Loads a Spline from a URL. The spline's configuration is derived from the JSON file itself.
     * @param {string} name - A unique name to assign to the loaded spline.
     * @param {string} url - The path to the spline-data.json file.
     * @returns {Promise<Spline>} A promise that resolves with the fully loaded and initialized Spline instance.
     */
    async load(name, url) {
        if (this.splines.has(name)) {
            console.warn(`SplineManager: A spline named '${name}' already exists.`);
            return this.splines.get(name);
        }

        const splineGUIFolder = this.gui.addFolder(name);
        splineGUIFolder.close();

        // The constructor is called with an empty config because the real config will be in the file.
        const spline = new Spline(this.THREE, this.scene, splineGUIFolder, {}, name);
        await spline.initialize(url,this.camera,this.canva); // Initialize by loading from the URL

        this.splines.set(name, spline);
        this._updateGUIDropdown();
        
        // Only set as active if this is the first spline or no active spline is set
        if (this.activeSplineName === null || this.activeSplineName === 'None') {
            this._setActiveSpline(name);
        }

        return spline;
    }

    /**
     * Retrieves a managed spline instance by its name.
     * @param {string} name - The name of the spline to get.
     * @returns {Spline|undefined}
     */
    get(name) {
        return this.splines.get(name);
    }

    /**
     * Gets all managed splines.
     * @returns {Map<string, Spline>} Map of all splines keyed by name.
     */
    getAll() {
        return new Map(this.splines);
    }

    /**
     * Removes a spline from the manager and cleans up its resources.
     * @param {string} name - The name of the spline to remove.
     * @returns {boolean} True if the spline was removed, false if it didn't exist.
     */
    remove(name) {
        if (!this.splines.has(name)) {
            return false;
        }

        const spline = this.splines.get(name);
        
        // Clean up the spline's GUI folder
        if (spline.guiFolder) {
            this.gui.removeFolder(spline.guiFolder);
        }

        // If this was the active spline, reset to 'None'
        if (this.activeSplineName === name) {
            this._setActiveSpline('None');
        }

        this.splines.delete(name);
        this._updateGUIDropdown();
        
        return true;
    }

    /**
     * Sets up the master GUI for the SplineManager.
     */
    setupGUI() {
        this.guiFolder = this.gui.addFolder('Spline Manager');
        this.dropdownController = this.guiFolder.add(this.guiProxy, 'activeSpline', ['None']).name('Edit Spline');
        
        this.dropdownController.onChange(name => {
            this._setActiveSpline(name);
        });

        this.guiFolder.open();
    }

    /**
     * Updates the list of available splines in the GUI dropdown.
     */
    _updateGUIDropdown() {
        const splineNames = ['None', ...this.splines.keys()];
        this.dropdownController.options(splineNames);
    }
    
    /**
     * Hides all spline GUIs and shows only the one for the selected spline.
     * @param {string} name - The name of the spline to activate.
     */
    _setActiveSpline(name) {
        // Hide the previously active GUI
        if (this.activeSplineName && this.splines.has(this.activeSplineName)) {
            const oldSpline = this.splines.get(this.activeSplineName);
            if (oldSpline.guiFolder) {
                oldSpline.guiFolder.close();
            }
        }

        this.activeSplineName = name;
        this.guiProxy.activeSpline = name; // Sync proxy for the dropdown

        // Show the newly selected GUI
        if (name !== 'None' && this.splines.has(name)) {
            const newSpline = this.splines.get(name);
            if (newSpline.guiFolder) {
                newSpline.guiFolder.open();
            }
        }
    }
}