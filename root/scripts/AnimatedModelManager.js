import { ModelLoader } from './ModelLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class AnimatedModelManager {
    constructor(THREE, scene, gui) {
        this.THREE = THREE;
        this.scene = scene;
        this.gui = gui;
        this.model_loader = new ModelLoader(THREE, gui);
        
        this.animations = new Map(); // Store AnimationMixer and clips
        this.current_model = null;
        this.mixer = null;
    this._currentAction = null;

        if (gui) this.setupDebugUI();
    }

    /**
     * Initialize with a GLTF/GLB model containing animations
     * @param {string} modelConfigPath - Path to ModelLoader.json
     */
    async initialize(modelConfigPath) {
        // Try to initialize via ModelLoader JSON first (if provided)
        let loadedViaModelLoader = false;
        try {
            await this.model_loader.initialize(modelConfigPath);
            // Create instance of the animated model (name used in ModelLoader JSON)
            this.current_model = this.model_loader.createInstance('AssemblyModel', {
                position: { x: 0, y: 0, z: 0 },
                scale: { x: 1, y: 1, z: 1 }
            });

            if (this.current_model) {
                this.scene.add(this.current_model);
                this.mixer = new this.THREE.AnimationMixer(this.current_model);

                // If ModelLoader attached animations to the instance, collect them
                if (this.current_model.animations) {
                    this.current_model.animations.forEach(clip => this.animations.set(clip.name, clip));
                }

                loadedViaModelLoader = true;
            }
        } catch (e) {
            console.warn('AnimatedModelManager: ModelLoader JSON not present or failed, falling back to direct GLB load.', e);
        }

        // Fallback: if ModelLoader didn't provide a model, try loading a GLB directly from assets (e.g. assets/drone.glb)
        if (!loadedViaModelLoader) {
            try {
                await this.loadGLBFromAssets('assets/drone.glb');
            } catch (e) {
                console.error('AnimatedModelManager: Failed to load GLB fallback', e);
            }
        }
    }

    /**
     * Play a specific animation by name
     * @param {string} name - Name of the animation to play
     * @param {boolean} [loop=false] - Whether to loop the animation
     * @returns {Promise} Resolves when animation completes (if not looping)
     */
    playAnimation(name, loop = false) {
        if (!this.mixer || !this.animations.has(name)) {
            console.warn(`Animation "${name}" not found`);
            return Promise.reject(new Error(`Animation "${name}" not found`));
        }

        return this.playWithCrossfade(name, 0.25, loop);
    }

    /**
     * Play an animation with optional crossfade from the current action.
     * @param {string} name - clip name
     * @param {number} duration - crossfade duration in seconds
     * @param {boolean} loop - whether to loop
     */
    playWithCrossfade(name, duration = 0.25, loop = false) {
        if (!this.mixer || !this.animations.has(name)) {
            console.warn(`Animation "${name}" not found`);
            return Promise.reject(new Error(`Animation "${name}" not found`));
        }

        const clip = this.animations.get(name);
        const nextAction = this.mixer.clipAction(clip);

        // Prepare action
        nextAction.reset();
        if (!loop) {
            nextAction.setLoop(this.THREE.LoopOnce);
            nextAction.clampWhenFinished = true;
        }

        // Crossfade from previous
        if (this._currentAction && this._currentAction !== nextAction) {
            this._currentAction.crossFadeTo(nextAction, duration, false);
        }

        nextAction.play();
        this._currentAction = nextAction;

        return new Promise((resolve) => {
            if (loop) {
                resolve();
                return;
            }

            const onFinish = (e) => {
                if (e.action === nextAction) {
                    this.mixer.removeEventListener('finished', onFinish);
                    resolve();
                }
            };
            this.mixer.addEventListener('finished', onFinish);
        });
    }

    /**
     * Stop all playing animations
     */
    stopAnimations() {
        if (this.mixer) {
            this.mixer.stopAllAction();
        }
    }

    /**
     * Update animations
     * @param {number} deltaTime - Time since last frame in seconds
     */
    update(deltaTime) {
        if (this.mixer) {
            this.mixer.update(deltaTime);
        }
    }

    /**
     * Setup debug UI for testing animations
     */
    setupDebugUI() {
        const folder = this.gui.addFolder('Animation Control');
        
        const controls = {
            currentAnimation: '',
            loop: false,
            playAnimation: () => {
                if (controls.currentAnimation) {
                    this.playAnimation(controls.currentAnimation, controls.loop);
                }
            },
            stopAnimation: () => this.stopAnimations()
        };

        // We'll populate this once animations are loaded
        this.onAnimationsLoaded = () => {
            const animationNames = [...this.animations.keys()];
            if (animationNames.length > 0) {
                controls.currentAnimation = animationNames[0];
                folder.add(controls, 'currentAnimation', animationNames)
                    .name('Select Animation');
            }
        };

        folder.add(controls, 'loop').name('Loop Animation');
        folder.add(controls, 'playAnimation').name('Play');
        folder.add(controls, 'stopAnimation').name('Stop');
    }

    /**
     * Load a GLB/GLTF directly from the assets folder and add to the scene.
     * Useful when a ModelLoader JSON is not available.
     * @param {string} path - Relative path to the .glb file (e.g. 'assets/drone.glb')
     */
    async loadGLBFromAssets(path) {
        const loader = new GLTFLoader();

        return new Promise((resolve, reject) => {
            loader.load(path, (gltf) => {
                const model = gltf.scene || gltf.scenes[0];
                if (!model) return reject(new Error('GLTF contains no scene'));

                // Attach animations from gltf
                if (gltf.animations && gltf.animations.length > 0) {
                    this.mixer = new this.THREE.AnimationMixer(model);
                    gltf.animations.forEach(clip => this.animations.set(clip.name, clip));
                }

                this.current_model = model;
                this.scene.add(model);

                // Call UI population callback if present
                if (this.onAnimationsLoaded) this.onAnimationsLoaded();

                resolve(model);
            }, undefined, (err) => reject(err));
        });
    }
}