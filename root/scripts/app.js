import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import * as GUI from 'lilGUI';
import { VRButton } from 'three/webxr/VRButton.js';
import { OutlineManager } from './OutlineManager.js';
import { MeshGroupLoader } from './MeshGroupLoader.js';
import { VisibilityManager } from './VisibilityManager.js';
import { StepCardsUI } from './StepCardsUI.js';

export class application{
    constructor(){
        this.construct_Gui(); // Create GUI first
        this.construct_scene_And_Renderer();
        this.construct_camera();
        
        // Initialize camera background
        this.initializeCameraBackground();
        
        // Initialize OutlineManager for post-processing effects
        this.outlineManager = new OutlineManager(this.scene, this.Cam, this.renderer, this.gui);

        // Initialize MeshGroupLoader
        this.meshGroupLoader = new MeshGroupLoader();
        
        // Initialize VisibilityManager
        this.visibilityManager = null; // Will be initialized after groups are built
        
        // Initialize StepCardsUI
        this.stepCardsUI = new StepCardsUI();

        // Load the drone model (GLB) directly
        this.loadDroneModel('assets/drone.glb');
    }

    async initializeCameraBackground() {
        try {
            // Check if getUserMedia is supported
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('getUserMedia is not supported in this browser');
            }

            // Create video element for camera feed
            this.video = document.createElement('video');
            this.video.setAttribute('autoplay', '');
            this.video.setAttribute('muted', '');
            this.video.setAttribute('playsinline', '');
            this.video.muted = true; // Important for autoplay
            
            console.log('Requesting camera access...');
            
            // Try with simpler constraints first
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'environment',
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    },
                    audio: false
                });
            } catch (err) {
                console.warn('Failed with environment camera, trying any camera:', err);
                // Fallback to any available camera
                stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: false
                });
            }
            
            this.video.srcObject = stream;
            this.cameraStream = stream;
            
            // Wait for video to be ready
            await new Promise((resolve, reject) => {
                this.video.onloadedmetadata = () => {
                    this.video.play()
                        .then(resolve)
                        .catch(reject);
                };
                this.video.onerror = reject;
                
                // Timeout after 5 seconds
                setTimeout(() => reject(new Error('Video load timeout')), 5000);
            });
            
            console.log('Video playing, resolution:', this.video.videoWidth, 'x', this.video.videoHeight);

            // Use the DOM video element as a fullscreen background behind the WebGL canvas.
            // This avoids compositing issues between the EffectComposer and the video texture.
            this.useDomVideoBackground = true;
            Object.assign(this.video.style, {
                position: 'fixed',
                left: '0',
                top: '0',
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                zIndex: '0',
                backgroundColor: 'black'
            });
            document.body.appendChild(this.video);

            // Ensure the renderer canvas sits on top and is transparent (renderer was created with alpha:true)
            if (this.canvas) {
                this.canvas.style.position = 'relative';
                this.canvas.style.zIndex = '1';
            }

            // Initialize OpenCV canvas (will be shown only when processing is enabled)
            await this.initializeOpenCV().catch(() => {});

            console.log('Camera background initialized successfully (DOM video behind canvas)');
            
            // Add GUI control to toggle camera
            if (this.gui) {
                const cameraFolder = this.gui.addFolder('Camera');
                const cameraControls = {
                    showCamera: true,
                    showScene: true,
                    toggleCamera: async () => {
                        if (this.cameraStream) {
                            this.cameraStream.getTracks().forEach(track => track.stop());
                            this.cameraStream = null;
                            // Hide DOM video if present
                            if (this.video && this.video.style) this.video.style.display = 'none';
                            this.scene.background = new THREE.Color(0x1a1a1a);
                        } else {
                            await this.initializeCameraBackground();
                        }
                    }
                };
                cameraFolder.add(cameraControls, 'showCamera').name('Show Camera').onChange((value) => {
                    this.showCameraBackground = value;
                    if (this.video) this.video.style.display = value ? 'block' : 'none';
                    if (this.opencvCanvas) this.opencvCanvas.style.display = (value && this.cameraEffects?.enabled) ? 'block' : 'none';
                });
                cameraFolder.add(cameraControls, 'showScene').name('Show 3D Scene').onChange((value) => {
                    this.show3DScene = value;
                });
                cameraFolder.add(cameraControls, 'toggleCamera').name('Restart Camera');

                this.showCameraBackground = true;
                this.show3DScene = true;
            }
            
        } catch (error) {
            console.error('Failed to initialize camera:', error.message);
            console.error('Error details:', error);
            
            // Show user-friendly error message
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                console.error('Camera permission denied. Please allow camera access in browser settings.');
            } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                console.error('No camera found on this device.');
            } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
                console.error('Camera is already in use by another application.');
            } else if (error.name === 'OverconstrainedError') {
                console.error('Camera constraints not supported.');
            } else if (error.name === 'TypeError') {
                console.error('Camera access requires HTTPS or localhost.');
            }
            
            // Fallback to solid color background
            this.scene.background = new THREE.Color(0x1a1a1a);
            this.cameraEnabled = false;
        }
    }

    async initializeOpenCV() {
        try {
            // Load OpenCV.js from CDN
            if (typeof cv === 'undefined') {
                await this.loadOpenCVScript();
            }
            
            // Create canvas for OpenCV processing
            this.opencvCanvas = document.createElement('canvas');
            this.opencvCanvas.width = 640;
            this.opencvCanvas.height = 480;
            
            console.log('OpenCV initialized successfully');
            this.opencvReady = true;
            
            // Add GUI controls for OpenCV effects
            this.setupOpenCVGUI();
            
        } catch (error) {
            console.warn('OpenCV initialization failed:', error);
            this.opencvReady = false;
        }
    }

    loadOpenCVScript() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://docs.opencv.org/4.8.0/opencv.js';
            script.async = true;
            script.onload = () => {
                // Wait for cv to be ready
                const checkCV = setInterval(() => {
                    if (typeof cv !== 'undefined' && cv.Mat) {
                        clearInterval(checkCV);
                        resolve();
                    }
                }, 100);
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    setupOpenCVGUI() {
        if (!this.gui) return;
        
        const cvFolder = this.gui.addFolder('Camera Effects');
        
        this.cameraEffects = {
            enabled: false,
            edgeDetection: false,
            blur: 0,
            brightness: 1.0,
            contrast: 1.0,
            grayscale: false
        };
        
        cvFolder.add(this.cameraEffects, 'enabled').name('Enable Processing');
        cvFolder.add(this.cameraEffects, 'edgeDetection').name('Edge Detection');
        cvFolder.add(this.cameraEffects, 'blur', 0, 20, 1).name('Blur');
        cvFolder.add(this.cameraEffects, 'brightness', 0, 2, 0.1).name('Brightness');
        cvFolder.add(this.cameraEffects, 'contrast', 0, 2, 0.1).name('Contrast');
        cvFolder.add(this.cameraEffects, 'grayscale').name('Grayscale');
    }

    processVideoWithOpenCV() {
        if (!this.opencvReady || !this.cameraEffects.enabled || !this.video) {
            return;
        }

        try {
            // Ensure opencvCanvas is in the DOM and sized to cover the screen
            if (!this.opencvCanvas.parentElement) {
                Object.assign(this.opencvCanvas.style, {
                    position: 'fixed',
                    left: '0',
                    top: '0',
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    zIndex: '0',
                    display: 'block'
                });
                document.body.appendChild(this.opencvCanvas);
            }
            // Hide the original video element while showing processed canvas
            if (this.video) this.video.style.display = 'none';

            const ctx = this.opencvCanvas.getContext('2d');
            // Draw at canvas resolution, scale is handled by CSS
            ctx.drawImage(this.video, 0, 0, this.opencvCanvas.width, this.opencvCanvas.height);
            
            let src = cv.imread(this.opencvCanvas);
            let dst = new cv.Mat();
            
            // Apply grayscale
            if (this.cameraEffects.grayscale) {
                cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY);
                cv.cvtColor(dst, src, cv.COLOR_GRAY2RGBA);
            }
            
            // Apply blur
            if (this.cameraEffects.blur > 0) {
                const ksize = new cv.Size(this.cameraEffects.blur * 2 + 1, this.cameraEffects.blur * 2 + 1);
                cv.GaussianBlur(src, dst, ksize, 0, 0, cv.BORDER_DEFAULT);
                src.delete();
                src = dst.clone();
            }
            
            // Apply edge detection
            if (this.cameraEffects.edgeDetection) {
                cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY);
                cv.Canny(dst, dst, 50, 150);
                cv.cvtColor(dst, src, cv.COLOR_GRAY2RGBA);
            }
            
            // Apply brightness and contrast
            src.convertTo(dst, -1, this.cameraEffects.contrast, 
                         (this.cameraEffects.brightness - 1) * 100);
            
            // Update texture
            cv.imshow(this.opencvCanvas, dst);
            
            // If a WebGL background mesh exists, update it; otherwise the opencvCanvas DOM is visible
            if (this.backgroundMesh && this.backgroundMesh.material) {
                const texture = new THREE.CanvasTexture(this.opencvCanvas);
                this.backgroundMesh.material.map = texture;
                this.backgroundMesh.material.needsUpdate = true;
            }
            
            // Clean up
            src.delete();
            dst.delete();
            
        } catch (error) {
            console.warn('OpenCV processing error:', error);
        }
    }

    construct_scene_And_Renderer(){
        //--------this.scene--------
        this.scene = new THREE.Scene();

        // Camera background will be set up in initializeCameraBackground()
        // Fallback to transparent background
        this.scene.background = null;

        //--------Axis and Grid Debuggers------
        const axesHelper = new THREE.AxesHelper(22);
        this.scene.add(axesHelper);

        const GridHelpersize = 200;
        const Gridhelperdivisions = 200;
        const gridHelper = new THREE.GridHelper(GridHelpersize, Gridhelperdivisions);
        this.scene.add(gridHelper);
        const GridHelpersize2 = 200;
        const Gridhelperdivisions2 = 20;
        const gridHelper2 = new THREE.GridHelper(GridHelpersize2, Gridhelperdivisions2, 0x000000, 0x000000);
        this.scene.add(gridHelper2);

        this.AddLight_To_scene();

        //--------Renderer------
        this.renderer = new THREE.WebGLRenderer({ 
            alpha: true, 
            antialias: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.physicallyCorrectLights = true;
        this.renderer.autoClear = false; // Important for background rendering
        
        this.canvas = this.renderer.domElement;
        document.body.appendChild(this.canvas);

        // Enable WebXR
        this.renderer.xr.enabled = true;
        document.body.appendChild(VRButton.createButton(this.renderer));
    }

    loadDroneModel(path){
        const loader = new GLTFLoader();
        loader.load(
            path,
            async (gltf) => {
                const model = gltf.scene || gltf.scenes?.[0];
                if (!model) {
                    console.warn('GLTF contains no scene');
                    return;
                }
                // Optional: scale/position tweak
                model.scale.set(2, 2, 2);
                model.position.set(0, 0, 0);

                this.scene.add(model);
                this.droneModel = model;

                // Do not outline by default; leave selection empty
                this.outlineManager.setSelectedObjects([]);
                console.log('Drone model loaded:', path);

                // Log all mesh names for debugging
                console.log('=== All Mesh Names in Drone Model ===');
                const meshNames = [];
                model.traverse((child) => {
                    if (child.isMesh) {
                        meshNames.push(child.name);
                    }
                });
                console.log(meshNames);
                console.log(`Total meshes: ${meshNames.length}`);

                // Load mesh groups config and build groups
                try {
                    await this.meshGroupLoader.initialize('jsons/ConfigJson/MeshGroups.json');
                    this.meshGroupLoader.buildGroups(model);
                    console.log('MeshGroupLoader: Groups built');
                    
                    // Initialize VisibilityManager after groups are ready
                    this.visibilityManager = new VisibilityManager(this.meshGroupLoader, this.scene);
                    this.visibilityManager.initialize();
                } catch (err) {
                    console.warn('Failed to load mesh groups:', err);
                }

                // Load assembly config and setup step buttons
                try {
                    const response = await fetch('jsons/ConfigJson/AssemblyManager.json');
                    if (response.ok) {
                        this.assemblyConfig = await response.json();
                        this.outlineManager.setupStepButtons(model, this.assemblyConfig, this.meshGroupLoader, this.visibilityManager);
                        
                        // Initialize step cards UI with two callbacks
                        this.stepCardsUI.initialize(
                            this.assemblyConfig,
                            // onStepSelect (when card comes into focus by scrolling)
                            (step) => {
                                console.log('Step card focused:', step.id);
                                // Apply outline only (no visibility or movement changes)
                                // This will reset positions and visibility before applying new outline
                                this.outlineManager.applyStepOutline(step, model, this.meshGroupLoader, true, this.visibilityManager);
                            },
                            // onStepClick (when card is clicked)
                            (step) => {
                                console.log('Step card clicked:', step.id);
                                // Apply full animation (outline + fade + center)
                                this.outlineManager.applyFullStepAnimation(step, model, this.meshGroupLoader, this.visibilityManager);
                            }
                        );
                        
                        console.log('Assembly config loaded and step buttons created');
                    }
                } catch (err) {
                    console.warn('Failed to load assembly config:', err);
                }
            },
            undefined,
            (err) => {
                console.error('Failed to load drone model:', path, err);
            }
        );
    }

    construct_camera(){
        const fov = 45;
        const aspect = window.innerWidth / window.innerHeight;
        const near = 0.1;
        const far = 1000;
        this.Cam = new THREE.PerspectiveCamera(fov, aspect, near, far);
        this.Cam.position.set(0, 6.5 ,2);
        this.Cam.lookAt(0, 0, 0);

        this.Cam_Controls = new OrbitControls(this.Cam, this.canvas);
        this.Cam_Controls.enableDamping = true;
        // Lock translation: no panning, orbit around target only
        this.Cam_Controls.enablePan = false;
        this.Cam_Controls.enableRotate = true;
        this.Cam_Controls.enableZoom = true;
        // Always look at origin
        this.Cam_Controls.target.set(0, 0, 0);
        // Optional: constrain zoom distance
        this.Cam_Controls.minDistance = 0.5;
        this.Cam_Controls.maxDistance = 200;
        this.Cam_Controls.update();
    }

    construct_Gui(){
        try {
            this.gui = new GUI.GUI();
            this.gui.add(document, 'title');
            console.log('GUI initialized successfully');
        } catch (error) {
            console.warn('Failed to initialize GUI:', error);
            this.gui = null;
        }
    }

    AddLight_To_scene(){
        // Ambient light for general illumination
        this.ambientLight = new THREE.AmbientLight(0xffffff, 3);
        this.scene.add(this.ambientLight);

        // Main directional light (sun-like)
        this.directionalLight = new THREE.DirectionalLight(0xffffff,3);
        this.directionalLight.position.set(-6.3, 9.1, -10);
        this.scene.add(this.directionalLight);
        const helper = new THREE.DirectionalLightHelper( this.directionalLight, 5 );
        this.scene.add( helper );

        // Add some fill lights for better material definition
        const fillLight1 = new THREE.PointLight(0x9ca3af, 2);
        fillLight1.position.set(-5, 2, 2);
        this.scene.add(fillLight1);

        const fillLight2 = new THREE.PointLight(0x9ca3af, 1);
        fillLight2.position.set(5, -2, -2);
        this.scene.add(fillLight2);

        // Add subtle hemisphere light for ambient occlusion-like effect
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
        this.scene.add(hemiLight);
    }

    setupLightingGUI() {
        if (this.gui && this.renderer) {
            const lightingFolder = this.gui.addFolder('Lighting');
            
            lightingFolder.add(this.directionalLight, 'intensity', 0, 10, 0.1).name('Main Light');
            lightingFolder.add(this.ambientLight, 'intensity', 0, 5, 0.1).name('Ambient');
            lightingFolder.add(this.renderer, 'toneMappingExposure', 0, 2, 0.01).name('Exposure');
            
            const lightPos = lightingFolder.addFolder('Main Light Position');
            lightPos.add(this.directionalLight.position, 'x', -10, 10, 0.1);
            lightPos.add(this.directionalLight.position, 'y', -10, 10, 0.1);
            lightPos.add(this.directionalLight.position, 'z', -10, 10, 0.1);
        }
    }

    updateFPS(delta) {
        this.renderingData.frameCount++;
        this.renderingData.fpsAccumulator += delta;
        if (this.renderingData.fpsAccumulator >= 0.25) {
            const fps = this.renderingData.frameCount / this.renderingData.fpsAccumulator;
            this.renderingData.fps = fps.toFixed(1);
            this.renderingData.frameCount = 0;
            this.renderingData.fpsAccumulator = 0;
        }
    }

    update(deltaTime){
        let lastTime = 0;
        // In WebXR, we use setAnimationLoop instead of requestAnimationFrame
        this.renderer.setAnimationLoop((time) => {
            // Calculate delta time in seconds
            const dt = lastTime ? (time - lastTime) / 1000 : 0;
            lastTime = time;

            // Update outline blinking
            this.outlineManager.update(dt);

            // Process video with OpenCV if enabled
            if (this.opencvReady && this.cameraEffects?.enabled) {
                this.processVideoWithOpenCV();
            }

            // Handle rendering
            if (this.renderer.xr.isPresenting) {
                this.renderer.render(this.scene, this.Cam);
            } else {
                // Render camera background directly to screen first
                if (this.showCameraBackground !== false && this.backgroundScene && this.videoTexture) {
                    this.renderer.autoClear = true;
                    this.renderer.render(this.backgroundScene, this.backgroundCamera);
                }
                
                // Then render 3D scene with post-processing on top
                // The composer will render to the same framebuffer
                if (this.show3DScene !== false) {
                    // Tell the composer not to clear so camera background remains
                    this.renderer.autoClear = false;
                    this.renderer.clearDepth(); // Only clear depth buffer
                    this.outlineManager.render();
                    this.renderer.autoClear = true; // Reset for next frame
                }
            }

            // Update controls if they exist
            if (this.Cam_Controls) {
                this.Cam_Controls.update();
            }
        });
    }
}