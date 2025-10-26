
import { CameraPacingManager } from "./CameraPacingManager.js";
import { Car } from "./Car.js";
import { Following_Camera } from "./Following_Camera.js";
import { ModelLoader } from "./ModelLoader.js";
import { SplineManager } from "./Spline_Manager.js";
import { TriggerManager } from "./Trigger_manager.js";

export class Navigator{
    constructor(THREE,scene,gui){

        this.THREE = THREE;
        this.scene = scene;
        this.gui = gui;
        this.Model_Loader = new ModelLoader(this.THREE,this.gui);
        this.splineManager = new SplineManager(this.THREE,this.scene,this.gui);
        this.trigger_manager = new TriggerManager(this.THREE,this.scene,this.gui,this.splineManager);
        this.car =new Car(THREE,scene);
        this.FCam = new Following_Camera(THREE,scene,gui,this.trigger_manager,this.car);
        this.camParser = new CameraPacingManager(THREE,scene,gui)

    }


    async initialize(camera,canva,orbitControls){
        await this.Model_Loader.ready;
        await this.Model_Loader.initialize("../jsons/ConfigJson/ModelLoader.json");
        await this.splineManager.initialize("../jsons/ConfigJson/SplineManager.json",camera,canva,orbitControls)
        await this.trigger_manager.initialize("../jsons/ConfigJson/TriggerManager.json");
        await this.camParser.initialize(this.splineManager.get('Car_Spline'),this.splineManager.get('Cam_Spline'),"../jsons/camera-pacing-data.json")
        this._InitializeStaticMap();
        this._InitializeCar();
        this._initializeFCam();

    }



    _InitializeCar(){
        this.car.construct_mesh(this.Model_Loader);
        this.car.set_Spline(this.splineManager.get('Car_Spline'));
        this.trigger_manager.subscribe('SF_Car_CarSpline',this.car);

    }
    _initializeFCam(){
        this.FCam.set_Spline(this.splineManager.get('Cam_Spline'));
    }
    _InitializeStaticMap(){
        this.static_map = this.Model_Loader.createInstance("Map",{ scale: { x: 0.004, y:  0.004, z:  0.004 },position:{x: 0, y: -0, z:  0 }});
        this.unreal = this.Model_Loader.createInstance("Unity",{ scale: { x: 1, y:  1, z:  1 },position:{x:-33, y:  -1, z: -7 }});
        this.Model_Loader.addDebugControls(this.unreal);
        // this.scene.add(this.static_map);
        this.scene.add(this.unreal);
    }


    Update(deltaTime,scroll){
        // this.update_following_camera();
        this.car.performMvt(scroll)
        this.FCam.performMvt(scroll)
        this.trigger_manager.checkForCollisions(this.car);
    }

    ResetMvt(){
        this.FCam.ResetPos();
        this.car.ResetPos();
        this.trigger_manager.ResetTriggers();

    }


}