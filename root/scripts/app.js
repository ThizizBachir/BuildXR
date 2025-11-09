import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import * as GUI from 'lilGUI';
import { VRButton } from 'three/webxr/VRButton.js';
import { AssemblyManager } from './AssemblyManager.js';
import { AnimatedModelManager } from './AnimatedModelManager.js';





export class application{
    constructor(){
        this.construct_Gui(); // Create GUI first
        this.construct_scene_And_Renderer();
        this.construct_camera();
        this.construct_Loaders();

        // Initialize AnimatedModelManager to load a GLB directly from assets
        this.animated_manager = new AnimatedModelManager(THREE, this.scene, this.gui);
        this.animated_manager.initialize('assets/drone.glb').catch(err => {
            console.warn('AnimatedModelManager: Failed to load drone model:', err);
        });
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
        this.setupLightingGUI();
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




    AddRenderingFolder(){
        const renderingFolder = this.gui.addFolder('Rendering Data');
        renderingFolder.add(this.renderingData, 'fps').name('FPS').listen();
    }


    AddCameraFolder(){
        const cameraFolder = this.gui.addFolder('Camera Control');
        cameraFolder.add(this.cameraData, 'enableZoom').name('enableZoom').listen();
        cameraFolder.add(this.cameraData, 'enableScroll').name('enableScroll').listen();
        cameraFolder.add(this.cameraData, 'Mode', ['Flying']).name('Mode').listen()
            .onChange(val => {
                if (val === 'Flying') {
                this.cameraData.currentCamera = this.Flying_Camera;
                this.Flying_Camera_Controls.enableZoom = true;
                this.cameraData.enableZoom = true;
                }
                else if (val === 'Follower') {
                // Following camera mode removed - now using WebXR
                this.Flying_Camera_Controls.enableZoom = false;
                this.cameraData.enableZoom = false;
                }
            });
        cameraFolder.add(this, 'Reset').name('Reset');
    }

    async construct_Loaders(){
        // Only AnimatedModelManager is used for model loading and animation
    }


    AddLight_To_scene(){
        // Ambient light for general illumination
        this.ambientLight = new THREE.AmbientLight(0x404040, 1); // Subtle ambient light
        this.scene.add(this.ambientLight);

        // Main directional light (sun-like)
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 3);
        this.directionalLight.position.set(5, 5, 5);
        this.directionalLight.castShadow = true;
        this.directionalLight.shadow.mapSize.width = 2048;
        this.directionalLight.shadow.mapSize.height = 2048;
        this.directionalLight.shadow.camera.near = 0.5;
        this.directionalLight.shadow.camera.far = 50;
        this.directionalLight.shadow.bias = -0.0001;
        this.scene.add(this.directionalLight);

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

    Initialise_Data(){
        this.renderingData= {
            prevTime : 0,


            // FPS cap
            MAX_FPS : 60,
            FRAME_DURATION : 1 / 60, // ~0.0167s

            fps: 0,

            frameCount :0,
            fpsAccumulator :0,

        }
        this.cameraData ={
            currentCamera : this.Flying_Camera,
            enableZoom : true,
            Mode : "Flying"// Flying, Follower

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


    updateCamera(deltaTime){
        this.Flying_Camera_Controls.enableZoom = this.cameraData.enableZoom;

    }



    update(deltaTime){
        // In WebXR, we use setAnimationLoop instead of requestAnimationFrame
        this.renderer.setAnimationLoop(() => {
            // Update animated model
            if (this.animated_manager) {
                this.animated_manager.update(deltaTime);
            }
            
            this.renderer.render(this.scene, this.Cam);
        });
    }
    
}
    
