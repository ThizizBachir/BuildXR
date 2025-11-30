import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class AnimatedModelManager {
    constructor(THREE, scene, gui) {
        this.THREE = THREE;
        this.scene = scene;
        this.gui = gui;
        this.animations = new Map(); // Store AnimationMixer and clips
        this.current_model = null;
        this.mixer = null;
        this._currentAction = null;
        if (gui) this.setupDebugUI();
    }

    /**
     * Initialize with a GLTF/GLB model containing animations
     * @param {string} modelPath - Path to the GLB/GLTF file
     */
    async initialize(modelPath = 'assets/New Folder/drone.glb') {
        console.log('AnimatedModelManager: Loading model from:', modelPath);
        try {
            const response = await fetch(modelPath);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            await this.loadGLBFromAssets(modelPath);
            console.log('AnimatedModelManager: Model loaded successfully');
        } catch (e) {
            console.error('AnimatedModelManager: Failed to load GLB from ' + modelPath, e);
            console.log('Creating fallback cube...');
            
            // Create a fallback cube so we can see something
            const geometry = new this.THREE.BoxGeometry(2, 2, 2);
            const material = new this.THREE.MeshPhongMaterial({ 
                color: 0x00ff00,
                wireframe: true
            });
            this.current_model = new this.THREE.Mesh(geometry, material);
            this.scene.add(this.current_model);
            
            // Create a simple rotation animation for the cube
            const rotationClip = new this.THREE.AnimationClip('rotate', 1, [
                new this.THREE.VectorKeyframeTrack(
                    '.rotation[y]',
                    [0, 1],
                    [0, Math.PI * 2]
                )
            ]);
            
            this.mixer = new this.THREE.AnimationMixer(this.current_model);
            const action = this.mixer.clipAction(rotationClip);
            action.setLoop(this.THREE.LoopRepeat);
            action.play();
            
            this.animations.set('rotate', rotationClip);
            
            // Don't throw the error since we've handled it with a fallback
            console.log('Fallback cube created with rotation animation');
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

                // Scale the model by 2x
                model.scale.set(2, 2, 2);

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