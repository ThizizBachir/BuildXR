/**
 * Manages the assembly sequence of 3D parts using step-based approach.
 * Coordinates outlining, visibility, and staging for step-by-step assembly.
 */
export class AssemblyManager {
    constructor(THREE, scene, gui) {
        this.THREE = THREE;
        this.scene = scene;
        this.gui = gui;

        // Current state
        this.current_step = 0;
        this.is_assembling = false;
        this.assembly_config = null;
        this.loaded_model = null;

        if (gui) this.setupDebugUI();
    }

    /**
     * Initialize the assembly manager with configuration and model
     * @param {string} assemblyConfigPath - Path to assembly sequence configuration (defines steps)
     * @param {Object3D} model - The loaded drone model (from ModelLoader or direct GLTFLoader)
     */
    async initialize(assemblyConfigPath, model) {
        try {
            // Load and parse assembly sequence config
            const response = await fetch(assemblyConfigPath);
            if (!response.ok) throw new Error(`Failed to load assembly config: ${response.status}`);
            this.assembly_config = await response.json();

            // Store model reference
            this.loaded_model = model;

            console.log('AssemblyManager: Initialization complete ✅');
        } catch (error) {
            console.error('AssemblyManager: Failed to initialize', error);
            throw error;
        }
    }

    /**
     * Start a specific assembly step
     * @param {string} stepId - The step ID from the config
     */
    startStep(stepId) {
        if (!this.assembly_config || !this.loaded_model) {
            console.error('AssemblyManager: Not initialized');
            return;
        }

        const step = this.assembly_config.steps.find(s => s.id === stepId);
        if (!step) {
            console.error(`AssemblyManager: Step "${stepId}" not found`);
            return;
        }

        console.log(`AssemblyManager: Starting step "${stepId}"`);
        // TODO: Implement step execution (outline, hide, stage)
        // Will integrate with OutlineManager, VisibilityManager, StagingManager
    }

    /**
     * Stop the current step and restore scene
     */
    stopStep() {
        console.log('AssemblyManager: Stopping current step');
        // TODO: Clear outlines, restore visibility, unstage
    }

    /**
     * Set up debug UI controls
     */
    setupDebugUI() {
        const folder = this.gui.addFolder('Assembly Control');
        
        const controls = {
            startAssembly: () => this.startAssembly(),
            resetAssembly: () => this.resetAssembly(),
            currentStep: 0
        };

        folder.add(controls, 'startAssembly').name('Start Assembly');
        folder.add(controls, 'resetAssembly').name('Reset Assembly');
        folder.add(controls, 'currentStep', 0, 10, 1)
            .name('Current Step')
            .onChange(value => {
                this.current_step = value;
            });
    }

    /**
     * Reset the assembly to its initial state
     */
    resetAssembly() {
        this.is_assembling = false;
        this.current_step = 0;

    /**
     * Set up debug UI controls
    //  */
    // setupDebugUI() {
    //     const folder = this.gui.addFolder('Assembly Steps');
        
    //     const controls = {
    //         currentStep: 'step-01',
    //         startStep: () => this.startStep(controls.currentStep),
    //         stopStep: () => this.stopStep()
    //     };

    //     folder.add(controls, 'currentStep').name('Step ID');
    //     folder.add(controls, 'startStep').name('Start Step');
    //     folder.add(controls, 'stopStep').name('Stop Step');
    // }

    /**
     * Update method called each frame
     * @param {number} deltaTime - Time since last frame in seconds
    //  */
    // update(deltaTime) {
    //     // TODO: Update blinking outlines, tweens, etc.
    }}