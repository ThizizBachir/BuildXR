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






    construct_scene_And_Renderer(){
        //--------this.scene--------
        this.scene = new THREE.Scene();

        // Load a cube map as the background
        const loader = new THREE.CubeTextureLoader();
        // Example: expects 6 images named px, nx, py, ny, pz, nz in assets/cubemap/
        const cubeTexture = loader.load([
            'assets/cubemap/px.jpg',
            'assets/cubemap/nx.jpg',
            'assets/cubemap/py.jpg',
            'assets/cubemap/ny.jpg',
            'assets/cubemap/pz.jpg',
            'assets/cubemap/nz.jpg',
        ]);
        this.scene.background = cubeTexture;

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
        
        this.canvas = this.renderer.domElement;
        document.body.appendChild(this.canvas);

        // Enable WebXR
        this.renderer.xr.enabled = true;
        document.body.appendChild(VRButton.createButton(this.renderer));
        
        // Setup lighting GUI controls after renderer is created
        // this.setupLightingGUI();
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
                        
                        // Initialize step cards UI (visual only, not linked to functionality yet)
                        this.stepCardsUI.initialize(this.assemblyConfig, (step) => {
                            console.log('Step card clicked:', step.id, '- functionality not linked yet');
                        });
                        
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
        // Optional: keep camera above horizon if desired
        // this.Cam_Controls.minPolarAngle = 0.01;
        // this.Cam_Controls.maxPolarAngle = Math.PI - 0.01;
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

    // deleted unecessary folders from GUI for clarity
   


    AddLight_To_scene(){
        // Ambient light for general illumination
        this.ambientLight = new THREE.AmbientLight(0xffffff, 3); // Subtle ambient light
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

            // Handle XR rendering
            if (this.renderer.xr.isPresenting) {
                this.renderer.render(this.scene, this.Cam);
            } else {
                // Use OutlineManager to render with post-processing
                this.outlineManager.render();
            }

            // Update controls if they exist
            if (this.Cam_Controls) {
                this.Cam_Controls.update();
            }
        });
    }
    
}

