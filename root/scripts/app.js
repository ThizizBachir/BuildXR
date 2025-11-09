import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import * as GUI from 'lilGUI';
import { VRButton } from 'three/webxr/VRButton.js';





export class application{
    constructor(){
        this.construct_scene_And_Renderer()
        this.construct_camera();
        this.construct_Gui();


    }






    construct_scene_And_Renderer(){
        //--------this.scene--------
        this.scene = new THREE.Scene();
        
        this.scene.background = new THREE.Color(0xAAAAAA);
        
        //--------Axis and Grid Debuggers------
        
        const axesHelper = new THREE.AxesHelper( 22 );
        this.scene.add( axesHelper );
        
        
        const GridHelpersize = 200;
        const Gridhelperdivisions = 200;
        
        const gridHelper = new THREE.GridHelper( GridHelpersize, Gridhelperdivisions );
        this.scene.add( gridHelper );
        const GridHelpersize2 = 200;
        const Gridhelperdivisions2 = 20;
        
        const gridHelper2 = new THREE.GridHelper( GridHelpersize2, Gridhelperdivisions2,0x000000,0x000000 );
        this.scene.add( gridHelper2 );

        this.AddLight_To_scene();
        
        //--------Renderer------
        
        this.renderer = new THREE.WebGLRenderer({alpha: true, antialias: true});
        this.renderer.setSize( window.innerWidth, window.innerHeight );
        this.canvas=this.renderer.domElement;
        document.body.appendChild( this.canvas);
        
        // Enable WebXR
        this.renderer.xr.enabled = true;
        document.body.appendChild( VRButton.createButton(this.renderer) );
        
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
        this.gui=new GUI.GUI();
        this.gui.add(document, 'title');
        // this.AddScrollFolder();
        // this.AddRenderingFolder();
        // this.AddCameraFolder();

    }


    AddScrollFolder(){
        const ScrollFolder = this.gui.addFolder('Scroll Control');
        ScrollFolder.add(this.scrollData, 'currentScroll').name('current_scroll').listen();
        ScrollFolder.add(this.scrollData, 'targetScroll').name('target_scroll').listen();
    }


    AddRenderingFolder(){
        const renderingFolder = this.gui.addFolder('Rendering Data');
        renderingFolder.add(this.renderingData, 'fps').name('FPS').listen();
    }


    AddCameraFolder(){
        const cameraFolder = this.gui.addFolder('Camera Control');
        cameraFolder.add(this.cameraData, 'enableZoom').name('enableZoom').listen();
        cameraFolder.add(this.cameraData, 'enableScroll').name('enableScroll').listen();
        cameraFolder.add(this.cameraData, 'Mode', ['Flying', 'Follower']).name('Mode').listen()
            .onChange(val => {
                if (val === 'Flying') {
                this.cameraData.currentCamera = this.Flying_Camera  ;
                this.Flying_Camera_Controls.enableZoom = true;
                this.cameraData.enableScroll = false;
                this.cameraData.enableZoom = true;
                }
                else if (val=== 'Follower'){
                this.cameraData.currentCamera = this.following_Camera;
                this.Flying_Camera_Controls.enableZoom = false;
                this.cameraData.enableZoom = false;
                this.cameraData.enableScroll = true;
                }
            });
        cameraFolder.add(this, 'Reset').name('Reset');
    }

    async construct_Loaders(){
        this.fbxLoader = new FBXLoader();
        this.textureLoader = new THREE.TextureLoader();
        this.Model_Loader =  new ModelLoader(THREE,this.fbxLoader,this.textureLoader,this.gui);
        await this.Model_Loader.ready;
    }


    AddLight_To_scene(){
        const ambienLight_Color = 0xffffff;
        const ambienLight_Intensity = 4;

        this.ambientLight = new THREE.AmbientLight(ambienLight_Color, ambienLight_Intensity); // Soft white light
        this.scene.add(this.ambientLight);

        const directionalLight_Color = 0xffffff;
        const directionalLight_Intensity = 8;
        const directionalLight_Position = new THREE.Vector3(20, 18.5, -3.5);

        
        this.directionalLight = new THREE.DirectionalLight(directionalLight_Color, directionalLight_Intensity);
        this.directionalLight.position.set(directionalLight_Position); // Position it to shine from the top-right-front
        this.scene.add(this.directionalLight);
    }

    Initialise_Data(){
        this.scrollData= {
            currentScroll : 0,
            targetScroll : 0,
            LERP_FACTOR : 0.08,
        }

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
            enableScroll: false,
            Mode : "Flying",// Flying, Follower

        }
    }

    listen_to_Scroll(deltaY){
        if(this.cameraData.enableScroll){
            const scrollFactor = 0.002;
            this.scrollData.targetScroll += deltaY*scrollFactor;
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
            this.renderer.render(this.scene, this.Cam);
        });
    }
    
}
    
