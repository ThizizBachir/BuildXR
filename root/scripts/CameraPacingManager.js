export class CameraPacingManager {
    constructor(THREE, scene, gui) {

        this.THREE = THREE;
        this.scene = scene;
        this.gui = gui;

        this.guiFolder = null;

        // --- Data ---
        // The data structure now uses curveIndex and a local t value.
        this.syncPoints = []; // The array of { car: { curveIndex, t }, cam: { curveIndex, t } }
        
        // --- State ---
        this.currentIndex = 0;
        this.currentSpeedFactor = 1.0;

        // --- Visuals ---
        this.carMarkers = [];
        this.camMarkers = [];
        this.syncLines = [];

        // --- GUI ---
        this.cursor = 0;
        this.guiProxy = { 
            car: { curveIndex: 0, t: 0 },
            cam: { curveIndex: 0, t: 0 }
        };
    }

    /**
     * Asynchronously loads the pacing data from a URL or initializes with a default point.
     * @param {string|null} url - The path to the JSON configuration file.
     */
    async initialize(carSpline, cameraSpline,url = null) {

        if (!carSpline || !cameraSpline) {
            throw new Error("CameraPacingManager requires valid car and camera splines.");
        }
        this.carSpline = carSpline;
        this.cameraSpline = cameraSpline;
        if (url) {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                this._rebuildFromJSON(data);
                console.log("CameraPacingManager initialized successfully from URL.");
            } catch (error) {
                console.error(`CameraPacingManager: Failed to initialize from ${url}`, error);
                alert("CameraPacingManager: Failed to initialize from URL. Check console.");
            }
        } else {
            // If no URL, create a default sync point at the start of the first curve of both splines.
            this.syncPoints = [{ 
                car: { curveIndex: 0, t: 0 },
                cam: { curveIndex: 0, t: 0 }
            }];
            this._rebuildVisuals();
            this._updateGUIProxy();
            this._recalculateSpeedFactor();
            console.log("CameraPacingManager initialized with a default sync point.");
        }
        this.setupGUI();
    }

    /**
     * The main update method. Checks if the car has reached the next sync point.
     * @param {number} carGlobalT - The car's current progress (0-1) along its ENTIRE spline.
     */
    update(camGlobalT) {
        if (this.syncPoints.length < 2) return;

        const nextIndex = (this.currentIndex + 1) % this.syncPoints.length;
        const nextSyncPoint = this.syncPoints[nextIndex];
        
        // Convert the next sync point's CAMERA position to a global T value for comparison
        const nextGlobalT = this._getGlobalT(this.cameraSpline, nextSyncPoint.cam);
        const currentGlobalT = this._getGlobalT(this.cameraSpline, this.syncPoints[this.currentIndex].cam);

        const hasReachedNext = (this.currentIndex > nextIndex)
            ? (camGlobalT < currentGlobalT && camGlobalT >= 0) // Camera has looped past the end
            : (camGlobalT >= nextGlobalT);

        if (hasReachedNext) {
            this.currentIndex = nextIndex;
            this._recalculateSpeedFactor();
        }
    }

    /**
     * Returns the calculated speed the CAR should have, based on the camera's current speed.
     * @param {number} cameraSpeed - The camera's current base speed.
     * @returns {number} The target speed for the car.
     */
    getTargetCarSpeed(cameraSpeed) {
        return cameraSpeed * this.currentSpeedFactor;
    }

    /**
     * The core logic. Calculates the ratio of distances ALONG THE CURVES between sync points.
     */
    _recalculateSpeedFactor() {
        if (this.syncPoints.length < 1) {
            this.currentSpeedFactor = 1.0; return;
        }

        // If only one sync point, ratio is based on the total length of the splines.
        if (this.syncPoints.length === 1) {
            const carTotalLength = this.carSpline.curvesPath.getLength();
            const camTotalLength = this.cameraSpline.curvesPath.getLength();
            // This is the ratio of car distance to camera distance
            this.currentSpeedFactor = camTotalLength > 0.001 ? carTotalLength / camTotalLength : 1.0;
            return;
        }
        
        const currentPoint = this.syncPoints[this.currentIndex];
        const nextIndex = (this.currentIndex + 1) % this.syncPoints.length;
        const nextPoint = this.syncPoints[nextIndex];

        // Calculate the distance along the curve for both the car and camera splines
        const carDist = this._getCurveDistanceBetweenPoints(this.carSpline, currentPoint.car, nextPoint.car);
        const camDist = this._getCurveDistanceBetweenPoints(this.cameraSpline, currentPoint.cam, nextPoint.cam);
        
        // The factor is how much faster/slower the car should be relative to the camera
        this.currentSpeedFactor = camDist > 0.001 ? carDist / camDist : 1.0;
    }
    
    /**
     * Calculates the distance along a spline between two points defined by {curveIndex, t}.
     * Handles wrap-around for closed splines.
     */
    _getCurveDistanceBetweenPoints(spline, startPointData, endPointData) {
        // Helper to get the absolute length from the start of the spline to a point
        const getGlobalLength = (spline, curveData) => {
            const lengths = spline.curvesPath.getCurveLengths();
            const startLengthOfCurve = curveData.curveIndex > 0 ? lengths[curveData.curveIndex - 1] : 0;
            const lengthOfCurve = spline.curvesPath.curves[curveData.curveIndex].getLength();
            const lengthAlongCurve = lengthOfCurve * curveData.t;
            return startLengthOfCurve + lengthAlongCurve;
        };

        const totalLength = spline.curvesPath.getLength();
        if (totalLength === 0) return 0;

        const startGlobalLength = getGlobalLength(spline, startPointData);
        const endGlobalLength = getGlobalLength(spline, endPointData);

        if (endGlobalLength >= startGlobalLength) {
            // Simple case: moving forward on the spline
            return endGlobalLength - startGlobalLength;
        } else {
            // Wrap-around case: passed the end of the spline
            return (totalLength - startGlobalLength) + endGlobalLength;
        }
    }

    setupGUI() {
        this.guiFolder = this.gui.addFolder("Camera Pacing Manager");

        const addPointEditor = (target, name, spline) => {
            const folder = this.guiFolder.addFolder(`${name} Sync Point`);
            folder.add(this.guiProxy[target], 'curveIndex').name("Curve Index").listen().disable();
            folder.add({ prev: () => this._moveCurve(target, -1) }, 'prev').name("< Prev Curve");
            folder.add({ next: () => this._moveCurve(target, 1) }, 'next').name("Next Curve >");
            folder.add(this.guiProxy[target], 't', 0, 1, 0.001).name("Position on Curve (t)").listen().onChange(v => {
                this.syncPoints[this.cursor][target].t = v;
                this._updateVisuals();
                this._recalculateSpeedFactor();
            });
        };

        addPointEditor('car', 'Car', this.carSpline);
        addPointEditor('cam', 'Camera', this.cameraSpline);

        this.guiFolder.add(this, '_prevPoint').name("< Prev Sync Point");
        this.guiFolder.add(this, '_nextPoint').name("Next Sync Point >");
        this.guiFolder.add(this, 'addPoint').name("Add Sync Point");
        this.guiFolder.add(this, 'deletePoint').name("Delete Sync Point");
        this.guiFolder.add(this, '_saveToFile').name("Save to JSON");
    }

    _moveCurve(target, direction) {
        const spline = target === 'car' ? this.carSpline : this.cameraSpline;
        const numCurves = spline.curvesPath.curves.length;
        const point = this.syncPoints[this.cursor][target];
        point.curveIndex = (point.curveIndex + direction + numCurves) % numCurves;
        this._updateVisuals();
        this._recalculateSpeedFactor();
        this._updateGUIProxy();
    }
    
    addPoint() {
        const newPoint = this.syncPoints.length > 0 ? JSON.parse(JSON.stringify(this.syncPoints[this.cursor])) : { car: { curveIndex: 0, t: 0 }, cam: { curveIndex: 0, t: 0 } };
        this.syncPoints.splice(this.cursor + 1, 0, newPoint);
        this._rebuildVisuals();
        this._nextPoint();
    }

    deletePoint() {
        if (this.syncPoints.length <= 1) return;
        this.syncPoints.splice(this.cursor, 1);
        this.cursor = Math.max(0, this.cursor - 1);
        this._rebuildVisuals();
        this._updateGUIProxy();
    }
    
    _rebuildFromJSON(data) {
        this.syncPoints = data.syncPoints || [];
        this.currentIndex = 0;
        this._rebuildVisuals();
        this._updateGUIProxy();
        this._recalculateSpeedFactor();
    }

    _updateGUIProxy() {
        if (this.syncPoints[this.cursor]) {
            this.guiProxy.car.curveIndex = this.syncPoints[this.cursor].car.curveIndex;
            this.guiProxy.car.t = this.syncPoints[this.cursor].car.t;
            this.guiProxy.cam.curveIndex = this.syncPoints[this.cursor].cam.curveIndex;
            this.guiProxy.cam.t = this.syncPoints[this.cursor].cam.t;
        }
    }
    
    _nextPoint() { this.cursor = (this.cursor + 1) % this.syncPoints.length; this._updateGUIProxy(); }
    _prevPoint() { this.cursor = (this.cursor - 1 + this.syncPoints.length) % this.syncPoints.length; this._updateGUIProxy(); }
    
    // --- Visuals ---
    _rebuildVisuals() {
        [...this.carMarkers, ...this.camMarkers, ...this.syncLines].forEach(obj => {
            obj.geometry.dispose(); obj.material.dispose(); this.scene.remove(obj);
        });
        this.carMarkers = []; this.camMarkers = []; this.syncLines = [];

        this.syncPoints.forEach(() => {
            const carMat = new this.THREE.MeshBasicMaterial({ color: 0xffa500 });
            const camMat = new this.THREE.MeshBasicMaterial({ color: 0x00a5ff });
            const geo = new this.THREE.BoxGeometry(0.5, 0.5, 0.5);
            this.carMarkers.push(new this.THREE.Mesh(geo.clone(), carMat));
            this.camMarkers.push(new this.THREE.Mesh(geo.clone(), camMat));
            const lineMat = new this.THREE.LineBasicMaterial({ color: 0x0000ff });
            this.syncLines.push(new this.THREE.Line(new this.THREE.BufferGeometry(), lineMat));
        });
        this.scene.add(...this.carMarkers, ...this.camMarkers, ...this.syncLines);
        this._updateVisuals();
    }
    
    _updateVisuals() {
        this.syncPoints.forEach((point, i) => {
            const carPos = this.carSpline.curvesPath.curves[point.car.curveIndex].getPointAt(point.car.t);
            const camPos = this.cameraSpline.curvesPath.curves[point.cam.curveIndex].getPointAt(point.cam.t);
            this.carMarkers[i].position.copy(carPos);
            this.camMarkers[i].position.copy(camPos);
            this.syncLines[i].geometry.setFromPoints([carPos, camPos]);
        });
    }

    _getGlobalT(spline, curveData) {
        const lengths = spline.curvesPath.getCurveLengths();
        const totalLength = lengths[lengths.length - 1];
        if (totalLength === 0) return 0;
        
        const startLengthOfCurve = curveData.curveIndex > 0 ? lengths[curveData.curveIndex - 1] : 0;
        const lengthOfCurve = spline.curvesPath.curves[curveData.curveIndex].getLength();
        const lengthAlongCurve = lengthOfCurve * curveData.t;
        
        const globalLength = startLengthOfCurve + lengthAlongCurve;
        return globalLength / totalLength;
    }

    _saveToFile() {
        const data = { syncPoints: this.syncPoints };
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'camera-pacing-data.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

