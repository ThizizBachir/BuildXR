import { TriggersSet } from './TriggersSet.js'; // Assuming TriggersSet class is in this file

/**
 * Manages all TriggersSet instances, their GUIs, and the collision notification system.
 * It is configured from a master JSON file and retrieves spline references from a SplineManager.
 */
export class TriggerManager {
    constructor(THREE, scene, gui, splineManager) {
        this.THREE = THREE;
        this.scene = scene;
        this.gui = gui;
        this.splineManager = splineManager; // Reference to the SplineManager
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
            selectedSpline: 'None' // New property for spline selection
        };
        this.dropdownController = null;
        this.splineDropdownController = null; // New controller for spline selection

        this.setupGUI();
    }

    /**
     * Asynchronously loads a master configuration file and initializes all specified trigger sets.
     * @param {string} configUrl - The URL to the master JSON configuration file.
     */
    async initialize(configUrl) {
        if (!this.splineManager) {
            console.error("TriggerManager: SplineManager reference is missing. Cannot initialize.");
            return;
        }

        try {
            const response = await fetch(configUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const configData = await response.json();

            for (const triggerConfig of configData) {
                const { name, path, splineName } = triggerConfig;
                
                // Get the spline reference from the SplineManager
                const spline = this.splineManager.get(splineName);

                if (spline) {
                    await this._createAndLoadSet(name, spline, path);
                } else {
                    console.error(`TriggerManager: Could not find spline named '${splineName}' for trigger set '${name}'.`);
                }
            }
            
            // Update the spline dropdown after initialization
            this._updateSplineDropdown();
            
            console.log("TriggerManager initialized successfully.");
        } catch (error) {
            console.error(`TriggerManager: Failed to initialize from config file at ${configUrl}`, error);
            alert("Failed to initialize TriggerManager. Check console for details.");
        }
    }

    /**
     * Allows an animated object to listen for notifications. Prevents duplicate subscriptions.
     * @param {string} setName - The name of the trigger set.
     * @param {object} animatedObject - The object to be notified. Must have an `onTrigger(triggerName)` method.
     */
    subscribe(setName, animatedObject) {
        if (!this.subscribers.has(setName)) {
            console.error(`TriggerManager: No trigger set named '${setName}' found for subscription.`);
            return;
        }
        if (typeof animatedObject.onTrigger !== 'function') {
            console.error(`TriggerManager: The subscribed object must have an 'onTrigger(triggerName)' method.`);
            return;
        }
        
        const currentSubscribers = this.subscribers.get(setName);
        if (currentSubscribers.includes(animatedObject)) {
            console.warn(`TriggerManager: Object is already subscribed to '${setName}'. Ignoring.`);
            return;
        }
        currentSubscribers.push(animatedObject);
    }

    /**
     * The main update loop method. Checks for collisions with the next logical trigger.
     * @param {object} car - The car object, which must have a `getBoundingBox()` method.
     */
    checkForCollisions(car) {
        const carBox = car.getBoundingBox();
        if (!carBox) return;

        for (const [name, triggers] of this.triggersMap.entries()) {
            if (triggers.boxes.length === 0) continue;

            const nextIndex = this.nextTriggerIndex.get(name);
            const triggerBox = triggers.boxes[nextIndex];
            
            if (carBox.intersectsBox(triggerBox)) {
                const triggerData = triggers.triggers[nextIndex];
                
                const listeners = this.subscribers.get(name);
                console.log(`TRIGGER HIT: Set '${name}', Box '${triggerData.name}'. Notifying ${listeners.length} subscribers.`);
                for (const listener of listeners) {
                    listener.onTrigger(triggerData);
                }

                const newIndex = (nextIndex + 1) % triggers.boxes.length;
                this.nextTriggerIndex.set(name, newIndex);
            }
        }
    }
    
    // --- GUI Management ---
    setupGUI() {
        this.guiFolder = this.gui.addFolder('Trigger Manager');
        this.dropdownController = this.guiFolder.add(this.guiProxy, 'activeSet', ['None']).name('Edit Set');
        this.dropdownController.onChange(name => this._setActiveSet(name));
        
        const creationFolder = this.guiFolder.addFolder('Create New Set');
        creationFolder.add(this.guiProxy, 'newSetName').name('Set Name');
        
        // Add spline selection dropdown
        this.splineDropdownController = creationFolder.add(this.guiProxy, 'selectedSpline', ['None']).name('Select Spline');
        
        creationFolder.add(this, '_createNewSetFromGUI').name('Create');
    }

    /**
     * Updates the spline dropdown with available splines from the SplineManager.
     */
    _updateSplineDropdown() {
        if (!this.splineDropdownController) return;
        
        const splines = this.splineManager.getAll();
        const splineNames = ['None', ...splines.keys()];
        this.splineDropdownController.options(splineNames);
        
        // Set the first available spline as default if none selected
        if (this.guiProxy.selectedSpline === 'None' && splineNames.length > 1) {
            this.guiProxy.selectedSpline = splineNames[1]; // First spline (skip 'None')
        }
    }
    
    _createNewSetFromGUI() {
        const name = this.guiProxy.newSetName;
        const selectedSplineName = this.guiProxy.selectedSpline;
        
        // Validate set name
        if (!name || this.triggersMap.has(name)) {
            alert(`A trigger set named '${name}' already exists or the name is invalid.`);
            return;
        }
        
        // Validate spline selection
        if (selectedSplineName === 'None') {
            alert("Please select a spline before creating the trigger set.");
            return;
        }
        
        // Get the selected spline
        const selectedSpline = this.splineManager.get(selectedSplineName);
        if (!selectedSpline) {
            alert(`Selected spline '${selectedSplineName}' not found.`);
            return;
        }
        
        // Create the new trigger set
        this._createAndLoadSet(name, selectedSpline);
        
        // Reset the form
        this.guiProxy.newSetName = 'NewSet';
    }
    
    async _createAndLoadSet(name, spline, url = null) {
        // We pass the main GUI, and the TriggersSet class will create its own named folder inside it.
        const triggers = new TriggersSet(this.THREE, this.scene, this.gui, name, spline);
        
        if (url) {
            await triggers.loadFromURL(url);
        } else {
            // Add two default triggers if not loading from a file
            triggers.addBox();
            triggers.addBox();
        }

        this.triggersMap.set(name, triggers);
        this.subscribers.set(name, []);
        this.nextTriggerIndex.set(name, 0);
        triggers.setupGUI();

        this._updateGUIDropdown();
        this._setActiveSet(name); // Automatically select the new set
        return triggers;
    }

    _updateGUIDropdown() {
        const setNames = ['None', ...this.triggersMap.keys()];
        this.dropdownController.options(setNames);
    }
    
    _setActiveSet(name) {
        if (this.activeSetName && this.triggersMap.has(this.activeSetName)) {
            this.triggersMap.get(this.activeSetName).guiFolder.close();
        }
        this.activeSetName = name;
        this.guiProxy.activeSet = name;

        if (name !== 'None' && this.triggersMap.has(name)) {
            this.triggersMap.get(name).guiFolder.open();
        }
    }

    /**
     * Call this method to refresh the spline dropdown when splines are added/removed
     * from the SplineManager after TriggerManager initialization.
     */
    refreshSplineOptions() {
        this._updateSplineDropdown();
    }

    ResetTriggers(){
        for(const [name, index] of this.nextTriggerIndex.entries()){
            this.nextTriggerIndex.set(name,0);
            
        }
    }
}