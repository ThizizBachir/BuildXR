export class Following_Camera{
    constructor(THREE , scene , gui,TriggerManager,car){
        this.THREE = THREE;
        this.scene = scene;
        this.gui = gui;
        this.TriggerManager = TriggerManager;
        this.car = car;
        this.constructCamera()
        this.spline = null;
        this.speed = 2;
        this.mesh = new this.THREE.Group();
        // this.construct_mesh();
        this.curveIndex = 0;
        this.progress = 0;
        this.scrollfactor = 0.2;
    

    }
    constructCamera(){
            const fov = 45;
            const aspect = window.innerWidth / window.innerHeight;
            const near = 0.1;
            const far = 25;
            this.cam = new this.THREE.PerspectiveCamera(fov, aspect, near, far);
            this.cam.position.set(0, 6.5 ,2);
            this.cam.up.set(0,1,0);

            this.cam.lookAt(0, 0, 0);

            const helper = new this.THREE.CameraHelper( this.cam );
            // this.scene.add( helper );
        
    }


    set_Spline(Spline){
        this.spline = Spline;
    }



    performMvt(delta){
        // const scroll = delta * this.scrollfactor;
        let done = false;
        if(this.spline === null ){
            return;
        }
        const curve = this.spline.curvesPath.curves[this.curveIndex];
        
        done = this.performBezierTurn(delta, curve, curve.getLength());
        
        if(done){
            this.curveIndex++;
            if (this.curveIndex === this.spline.curvesPath.curves.length){
                this.curveIndex = 0;
            }
            this.progress = 0;
        }
        // this.cam.up.set(0,1,0);
            this.cam.rotation.z = 0;

        this.cam.lookAt(this.car.mesh.position.x, this.car.mesh.position.y, this.car.mesh.position.z);
// 
// this.cam.rotation.z = 0;
//         if(this.curveIndex === 0){
            
//         }

//         if(this.curveIndex === 1){
//             this.cam.rotation.z = 0;
//             this.scrollfactor = 0.1;

//         }


        // UPDATE: Recalculate the bounding box after movement
        // this.updateBoundingBox();
        

    }
    
    // // NEW METHOD: Update bounding box to current position
    // updateBoundingBox(){
    //     // Recalculate the bounding box from the current mesh position
    //     this.box.setFromObject(this.mesh);
        
    //     // Update the helper visualization
    //     if (this.helper) {
    //         this.helper.box.copy(this.box);
    //     }
    // }
    
    performBezierTurn(delta, activeTurnCurve, activeCurveLength, baseSpeed = this.speed) {
        // --- Pre-computation Check ---
        if (!activeTurnCurve || !activeCurveLength) {
            console.error("performBezierTurn called without an active curve. Set 'activeTurnCurve' and 'activeCurveLength' first.");
            return true;
        }

        // --- Progress Calculation ---
        const distanceThisFrame = baseSpeed * delta;
        const progressIncrement = activeCurveLength > 0 ? distanceThisFrame / activeCurveLength : 1;
        this.progress = Math.min(1, this.progress + progressIncrement);

        // --- Position Update ---
        const newPosition = activeTurnCurve.getPointAt(this.progress);
        this.cam.position.copy(newPosition);

        // --- Rotation Logic ---
        const tangent = activeTurnCurve.getTangentAt(this.progress);
        const angle = Math.atan2(tangent.x, tangent.z);
        const ROTATION_OFFSET = 0;
        // this.mesh.rotation.y = angle + ROTATION_OFFSET;

        // --- Completion Check ---
        return this.progress >= 0.999;
    }
     onTrigger(Boxname){
            const floatValue = parseFloat(Boxname.substring(1));

        if (isNaN(floatValue)) {
            console.warn(`Invalid float value in boxname: ${Boxname}`);
            return null;
        }
        this.scrollfactor = floatValue;



    }

    ResetPos(){
        this.curveIndex = 0;
        this.progress = 0;
        this.scrollfactor = 1;
    }
}
