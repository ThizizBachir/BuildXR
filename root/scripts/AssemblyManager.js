import { AnimatedModelManager } from './AnimatedModelManager.js';

/**
 * Manages the assembly sequence of 3D parts using splines and triggers.
 * Coordinates ModelLoader for parts and SplineManager for animation paths.
 */
export class AssemblyManager {
    constructor(THREE, scene, gui) {
        this.THREE = THREE;
        this.scene = scene;
        this.gui = gui;
        this.animated_manager = new AnimatedModelManager(THREE, scene, gui);

        // Current state
        this.current_step = 0;
        this.is_assembling = false;
        this.parts = new Map(); // kept for backward compatibility but not required

        if (gui) this.setupDebugUI();
    }

    /**
     * Initialize the assembly manager with configuration JSONs
     * @param {string} modelConfigPath - Path to ModelLoader.json for animated model (optional)
     * @param {string} assemblyConfigPath - Path to assembly sequence configuration (maps steps to clip names)
     */
    async initialize(modelConfigPath, assemblyConfigPath) {
        try {
            // Load and parse assembly sequence config
            const response = await fetch(assemblyConfigPath);
            if (!response.ok) throw new Error(`Failed to load assembly config: ${response.status}`);
            this.assembly_config = await response.json();

            // Initialize animated model manager (loads GLB via ModelLoader.json or falls back to assets)
            await this.animated_manager.initialize(modelConfigPath);

            // If the animated manager exposed available clips, notify UI population
            if (this.animated_manager.onAnimationsLoaded) this.animated_manager.onAnimationsLoaded();

            console.log('AssemblyManager: Initialization complete ✅');
        } catch (error) {
            console.error('AssemblyManager: Failed to initialize', error);
            throw error;
        }
    }

    /**
     * Load initial part instances from the model loader
     */
    async loadInitialParts() {
        // Parts are optional when using pre-authored GLB animations; keep this as a no-op for compatibility
        return;
    }

    /**
     * Start the assembly sequence from the beginning or a specific step
     * @param {number} [step=0] - Optional step number to start from
     */
    async startAssembly(step = 0) {
        if (this.is_assembling) {
            console.warn('AssemblyManager: Assembly already in progress');
            return;
        }

        this.current_step = step;
        this.is_assembling = true;
        
        try {
            await this.executeCurrentStep();
        } catch (error) {
            console.error('AssemblyManager: Error during assembly', error);
            this.is_assembling = false;
        }
    }

    /**
     * Execute the current assembly step
     */
    async executeCurrentStep() {
        const step = this.assembly_config.sequence[this.current_step];
        if (!step) {
            console.log('AssemblyManager: Assembly sequence complete! 🎉');
            this.is_assembling = false;
            return;
        }
        // If the sequence maps to clips, use AnimatedModelManager to play them
        if (step.clip) {
            try {
                await this.animated_manager.playWithCrossfade(step.clip, step.crossfade || 0.25, !!step.loop);
            } catch (e) {
                console.error(`AssemblyManager: Failed to play clip '${step.clip}'`, e);
            }
        }

        // Advance step
        this.current_step++;
        if (this.current_step < this.assembly_config.sequence.length) {
            await this.executeCurrentStep();
        } else {
            this.is_assembling = false;
        }
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

        // Reset all parts to their initial positions
        for (const [name, config] of Object.entries(this.assembly_config.parts)) {
            const part = this.parts.get(name);
            if (part) {
                if (config.visible_at_start) {
                    part.position.copy(config.initial_position);
                    if (config.initial_rotation) {
                        part.rotation.copy(config.initial_rotation);
                    }
                } else {
                    // Remove parts that shouldn't be visible at start
                    this.scene.remove(part);
                }
            }
        }
    }

    /**
     * Update method called each frame
     * @param {number} deltaTime - Time since last frame in seconds
     */
    update(deltaTime) {
        // Update animated model mixer
        if (this.animated_manager) {
            this.animated_manager.update(deltaTime);
        }
    }
}