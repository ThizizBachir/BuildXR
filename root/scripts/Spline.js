export class Spline {
    constructor(THREE, scene, gui, config = {},name) {
        this.THREE = THREE;
        this.scene = scene;
        this.gui = gui;
        this.guiFolder = null;
        this.name = name;

        // --- Configuration ---
        this.config = {
            mode: config.mode || 'XZ', // 'XZ', 'XY', 'YZ', 'XYZ'
            isClosed: config.isClosed || false,
            continuity: config.continuity || 'Full', // 'Full', 'Selective'
            globalOffset: config.globalOffset || 0
        };

        // --- Data ---
        this.points = [];
        this.cntrls = [];
        this.continuityFlags = []; // For 'Selective' continuity mode
        this.curvesPath = new this.THREE.CurvePath();
        
        // --- Visuals ---
        this.pointMeshes = [];
        this.cntrlMeshes = [];
        this.lineMeshes = [];
        
        // --- State & GUI ---
        this.cursorPt = 0;
        this.guiProxy = {
            anchor: { x: 0, y: 0, z: 0 },
            control: { x: 0, y: 0, z: 0 },
            isSmooth: true,
            nextCntrl : true, // Toggle between editing next (outgoing) or previous (incoming) control
        };

        this.isInitialized = false;
    }

    /**
     * Asynchronously initializes the spline, either from a URL or with a default curve.
     * This MUST be called after the constructor.
     * @param {string|null} url - The URL to a spline JSON file.
     */
    async initialize(url = null) {

        if (url) {
            await this.loadFromURL(url);
        } else {
            this._constructInitialFromConfig();
            this._rebuildAll();
        }
        this.isInitialized = true;
    }

    _constructInitialFromConfig() {
        let pt1 = new this.THREE.Vector3(0, 0, 0);
        let pt2 = new this.THREE.Vector3(5, 0, 0); // Default for XYZ

        switch (this.config.mode) {
            case 'XZ': pt2.set(5, 0, 0); break;
            case 'XY': pt2.set(5, 0, 0); break;
            case 'YZ': pt2.set(0, 5, 0); break;
        }

        this.points = [pt1, pt2];
        this.continuityFlags = [true, true];
        
        const cntrl1 = pt1.clone().lerp(pt2, 1 / 3);
        const cntrl2 = pt1.clone().lerp(pt2, 2 / 3);
        this.cntrls = [cntrl1, cntrl2];
    }

    add_Point() {
        if (this.points.length < 2) return;

        const curveIndex = this.config.isClosed && this.cursorPt === this.points.length - 1 ? this.points.length - 1 : this.cursorPt;
        const curve = this.curvesPath.curves[curveIndex];
        const p0 = curve.v0, c0 = curve.v1, c1 = curve.v2, p1 = curve.v3;

        // De Casteljau's algorithm to find the new points at t=0.5
        const p0_c0 = p0.clone().lerp(c0, 0.5);
        const c0_c1 = c0.clone().lerp(c1, 0.5);
        const c1_p1 = c1.clone().lerp(p1, 0.5);
        const p0_c0__c0_c1 = p0_c0.clone().lerp(c0_c1, 0.5);
        const c0_c1__c1_p1 = c0_c1.clone().lerp(c1_p1, 0.5);
        const newAnchor = p0_c0__c0_c1.clone().lerp(c0_c1__c1_p1, 0.5);

        this.points.splice(curveIndex + 1, 0, newAnchor);
        this.continuityFlags.splice(curveIndex + 1, 0, true);

        // **FIXED**: Replace the 2 old control points with the 4 new ones.
        // The old code was inserting 6 points instead of 4, causing the data corruption.
        const newControls = [p0_c0, p0_c0__c0_c1, c0_c1__c1_p1, c1_p1];
        this.cntrls.splice(curveIndex * 2, 2, ...newControls);
        
        this._rebuildAll();
    }
    
    closeSpline() {
        if (this.config.isClosed || this.points.length < 2) return;
        this.config.isClosed = true;

        const firstPt = this.points[0], lastPt = this.points[this.points.length - 1];
        const lastCntrl = this.cntrls[this.cntrls.length - 1], firstCntrl = this.cntrls[0];
        const newCntrl1 = lastPt.clone().multiplyScalar(2).sub(lastCntrl);
        const newCntrl2 = firstPt.clone().multiplyScalar(2).sub(firstCntrl);
        this.cntrls.push(newCntrl1, newCntrl2);

        this._rebuildAll();
    }
    delete_Point() {
        // Cannot delete if it would result in less than 2 points
        if (this.points.length <= 2) {
            alert("Cannot delete anchor. A spline requires at least 2 points.");
            return;
        }

        const deleteIndex = this.cursorPt;

        // Remove the anchor point and its continuity flag
        this.points.splice(deleteIndex, 1);
        this.continuityFlags.splice(deleteIndex, 1);

        // Remove the two control points that formed the curve starting from the deleted anchor
        // For closed splines, if we delete the first point, we must remove the last two controls.
        if (this.config.isClosed && deleteIndex === 0) {
            this.cntrls.pop();
            this.cntrls.pop();
        } else {
             // For all other cases, remove the two controls immediately following the previous curve segment
            this.cntrls.splice(deleteIndex * 2 - 2, 2);
        }
        
        // Adjust the cursor to a valid position
        this.cursorPt = Math.max(0, deleteIndex - 1);

        this._rebuildAll();
    }

    _rebuildAll() {
        this._clearVisuals();
        
        this.curvesPath = new this.THREE.CurvePath();
        const numCurves = this.config.isClosed ? this.points.length : this.points.length - 1;

        for (let i = 0; i < numCurves; i++) {
            const p1 = this.points[i];
            const p2 = this.points[(i + 1) % this.points.length];
            const c1 = this.cntrls[i * 2];
            const c2 = this.cntrls[i * 2 + 1];
            this.curvesPath.add(new this.THREE.CubicBezierCurve3(p1, c1, c2, p2));
        }

        this._applyPlanarConstraint();
        this._createVisuals();
        this.setupGUI();
        this._updateGUIProxy();
    }

    _updateContinuity(movedCntrlIndex) {
        const anchorIndex = Math.round(movedCntrlIndex / 2);
        
        if (this.config.continuity === 'Selective' && !this.continuityFlags[anchorIndex]) {
            return;
        }
        
        const isOutgoing = movedCntrlIndex % 2 === 0;
        let anchorPtIndex, pairedCntrlIndex;

        if (isOutgoing) {
            anchorPtIndex = movedCntrlIndex / 2;
            pairedCntrlIndex = movedCntrlIndex - 1;
        } else {
            anchorPtIndex = (movedCntrlIndex + 1) / 2;
            pairedCntrlIndex = movedCntrlIndex + 1;
        }
        
        if (this.config.isClosed) {
            anchorPtIndex = (anchorPtIndex + this.points.length) % this.points.length;
            pairedCntrlIndex = (pairedCntrlIndex + this.cntrls.length) % this.cntrls.length;
        }

        if (pairedCntrlIndex >= 0 && pairedCntrlIndex < this.cntrls.length) {
            const anchorPt = this.points[anchorPtIndex];
            const movedCntrl = this.cntrls[movedCntrlIndex];
            const pairedCntrl = this.cntrls[pairedCntrlIndex];
            pairedCntrl.copy(anchorPt).multiplyScalar(2).sub(movedCntrl);
        }
    }

    _applyPlanarConstraint() {
        if (this.config.mode === 'XYZ') return;
        const offset = this.config.globalOffset;
        const axis = this.config.mode === 'XY' ? 'z' : this.config.mode === 'YZ' ? 'x' : 'y';
        this.points.forEach(p => p[axis] = offset);
        this.cntrls.forEach(c => c[axis] = offset);
    }

    toJSON() {
        return {
            config: this.config,
            points: this.points.map(p => p.toArray()),
            cntrls: this.cntrls.map(c => c.toArray()),
            continuityFlags: this.continuityFlags,
        };
    }
    
    rebuildFromJSON(jsonString) {
        const data = JSON.parse(jsonString);
        this._clearVisuals();
        this.config = data.config;
        this.points = data.points.map(pArr => new this.THREE.Vector3().fromArray(pArr));
        this.cntrls = data.cntrls.map(cArr => new this.THREE.Vector3().fromArray(cArr));
        this.continuityFlags = data.continuityFlags || this.points.map(() => true);
        this.cursorPt = 0;
        this._rebuildAll();
    }

    setupGUI() {
        if (this.guiFolder) this.guiFolder.destroy();
        this.guiFolder = this.gui.addFolder('Spline Editor');

        const editorFolder = this.guiFolder.addFolder('Anchor & Control Editor');
        
        const addControl = (target, prop, name) => {
            return editorFolder.add(this.guiProxy[target], prop, -60, 60).name(name).listen();
        };

        const setupControls = (axes) => {
            axes.forEach(axis => {
                const anchorCtrl = addControl('anchor', axis, `Anchor ${axis.toUpperCase()}`);
                anchorCtrl.onChange(v => {
                    // Calculate the change in position (delta)
                    const oldValue = this.points[this.cursorPt][axis];
                    const delta = v - oldValue;

                    // Apply the delta to the anchor itself
                    this.points[this.cursorPt][axis] = v;

                    // Find the indices of the incoming and outgoing control points
                    const outgoingIndex = this.cursorPt * 2;
                    const incomingIndex = (this.cursorPt * 2 - 1 + this.cntrls.length) % this.cntrls.length;

                    // Apply the same delta to both associated control points so they move with the anchor
                    if (this.cntrls[outgoingIndex]) {
                        this.cntrls[outgoingIndex][axis] += delta;
                    }
                    if (this.cntrls[incomingIndex]) {
                        this.cntrls[incomingIndex][axis] += delta;
                    }

                    // Refresh visuals and GUI
                    this.updateVisuals();
                    this._updateGUIProxy();
                });
            });
            axes.forEach(axis => {
                const controlCtrl = addControl('control', axis, `Control ${axis.toUpperCase()}`);
                controlCtrl.onChange(v => {
                    const cntrl_Index = this.guiProxy.nextCntrl 
                        ? this.cursorPt * 2 
                        : (this.cursorPt * 2 - 1 + this.cntrls.length) % this.cntrls.length;
                    this.cntrls[cntrl_Index][axis] = v;
                    this._updateContinuity(cntrl_Index);
                    this.updateVisuals();
                });
            });
        };

        if (this.config.mode === 'XYZ') setupControls(['x', 'y', 'z']);
        if (this.config.mode === 'XZ') setupControls(['x', 'z']);
        if (this.config.mode === 'XY') setupControls(['x', 'y']);
        if (this.config.mode === 'YZ') setupControls(['y', 'z']);

        if (this.config.mode !== 'XYZ') {
            const axis = this.config.mode === 'XY' ? 'Z' : this.config.mode === 'YZ' ? 'X' : 'Y';
            this.guiFolder.add(this.config, 'globalOffset', -20, 20).name(`Global ${axis} Offset`).onChange(() => {
                this._applyPlanarConstraint(); this.updateVisuals();
            });
        }
        
        if (this.config.continuity === 'Selective') {
            editorFolder.add(this.guiProxy, 'isSmooth').name('Is Smooth').listen().onChange(v => {
                this.continuityFlags[this.cursorPt] = v;
                if (v) this._updateContinuity(this.cursorPt * 2);
                this.updateVisuals();
            });
        }

        editorFolder.add(this.guiProxy, 'nextCntrl').name('Edit Next Control').listen().onChange(() => this._updateGUIProxy());

        this.guiFolder.add(this, '_prevAnchor').name('< Previous Anchor');
        this.guiFolder.add(this, '_nextAnchor').name('Next Anchor >');
        this.guiFolder.add(this, 'add_Point').name('Subdivide Curve');
        this.guiFolder.add(this, 'delete_Point').name('Delete Anchor');
        if (!this.config.isClosed) {
            this.guiFolder.add(this, 'closeSpline').name('Close Spline');
        }

        const fileFolder = this.guiFolder.addFolder('File');
        fileFolder.add(this, '_saveToFile').name('Save to JSON');
        fileFolder.add(this, '_loadFromFile').name('Load from JSON');
        
        this.guiFolder.open();
    }
    
    _clearVisuals() {
        this.pointMeshes.forEach(m => {
            m.geometry.dispose();
            m.material.dispose();
            this.scene.remove(m);
        });
        this.cntrlMeshes.forEach(m => {
            m.geometry.dispose();
            m.material.dispose();
            this.scene.remove(m);
        });
        this.lineMeshes.forEach(m => {
            m.geometry.dispose();
            m.material.dispose();
            this.scene.remove(m);
        });
        this.pointMeshes = [];
        this.cntrlMeshes = [];
        this.lineMeshes = [];
    }

    _createVisuals() {
        this.points.forEach((p,index) => this._createPointMesh(p,index));
        this.cntrls.forEach((c,index) => this._createCntrlMesh(c,index));
        this.curvesPath.curves.forEach(cv => this._createLineMesh(cv));
        this.updateVisuals();
    }

    _createPointMesh(p,index) {
        const m = new this.THREE.Mesh(
            new this.THREE.SphereGeometry(.25, 32, 16),
            new this.THREE.MeshBasicMaterial({
                color: 0xff00ff
            })
        );
        m.userData.spline = this;
        m.userData.index = index;
        m.userData.type = "anchor";
        m.position.copy(p);
        this.pointMeshes.push(m);
        this.scene.add(m);
    }

    _createCntrlMesh(c,index) {
        const m = new this.THREE.Mesh(
            new this.THREE.SphereGeometry(.125, 32, 16),
            new this.THREE.MeshBasicMaterial({
                color: 0x888888
            })
        );
        m.position.copy(c);
        m.userData.spline = this;
        m.userData.index = index;
        m.userData.type = "control";
        this.cntrlMeshes.push(m);
        this.scene.add(m);
    }

    _createLineMesh(cv) {
        const ln = new this.THREE.Line(
            new this.THREE.BufferGeometry().setFromPoints(cv.getPoints(50)),
            new this.THREE.LineBasicMaterial({
                color: 0xffff00
            })
        );
        this.lineMeshes.push(ln);
        this.scene.add(ln);
    }

    updateVisuals() {
        this.lineMeshes.forEach((line, index) => {
            line.geometry.setFromPoints(this.curvesPath.curves[index].getPoints(50));
        });
        this.pointMeshes.forEach((mesh, index) => {
            mesh.position.copy(this.points[index]);
            mesh.material.color.set(index === this.cursorPt ? 0xff0000 : 0xff00ff);
        });
        
        // **NEW**: Implement the specific coloring for control points.
        this.cntrlMeshes.forEach((mesh, index) => {
            mesh.position.copy(this.cntrls[index]);
            const outgoingIndex = this.cursorPt * 2;
            const incomingIndex = (outgoingIndex - 1 + this.cntrls.length) % this.cntrls.length;

            if (index === incomingIndex) {
                mesh.material.color.set(0xFFF44F); // Lemon for previous/incoming
            } else if (index === outgoingIndex) {
                mesh.material.color.set(0x00FFFF); // Cyan for next/outgoing
            } else {
                mesh.material.color.set(0x888888); // Grey for all other non-selected
            }
        });
    }

    _nextAnchor() { this.cursorPt = (this.cursorPt + 1) % this.points.length; this._updateGUIProxy(); this.updateVisuals();}
    _prevAnchor() { this.cursorPt = (this.cursorPt - 1 + this.points.length) % this.points.length; this._updateGUIProxy(); this.updateVisuals();}

    _updateGUIProxy() {
        if (!this.points[this.cursorPt]) return;
        
        const point = this.points[this.cursorPt];
        this.guiProxy.anchor.x = point.x; this.guiProxy.anchor.y = point.y; this.guiProxy.anchor.z = point.z;
        
        // Determine which control point to show in the GUI based on the toggle
        const controlIndex = this.guiProxy.nextCntrl 
            ? this.cursorPt * 2 
            : (this.cursorPt * 2 - 1 + this.cntrls.length) % this.cntrls.length;
            
        const control = this.cntrls[controlIndex];
        if (control) {
            this.guiProxy.control.x = control.x; this.guiProxy.control.y = control.y; this.guiProxy.control.z = control.z;
        }
        
        if (this.config.continuity === 'Selective') {
            this.guiProxy.isSmooth = this.continuityFlags[this.cursorPt];
        }
    }

    _saveToFile() {const d=this.toJSON(),s=JSON.stringify(d,null,2),b=new Blob([s],{type:"application/json"}),u=URL.createObjectURL(b),a=document.createElement("a");a.href=u;a.download=this.name+".json";document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(u)}
    _loadFromFile() {const i=document.createElement("input");i.type="file";i.accept=".json,application/json";i.onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader;r.onload=ev=>{try{this.rebuildFromJSON(ev.target.result)}catch(err){console.error("Error parsing spline JSON:",err);alert("Failed to load spline.")}};r.readAsText(f)};i.click()}
    async loadFromURL(url) {try{const rs=await fetch(url);if(!rs.ok)throw new Error(`HTTP error! status: ${rs.status}`);this.rebuildFromJSON(await rs.text())}catch(e){console.error(`Failed to load spline from URL: ${url}`,e);alert(`Failed to load spline from URL.`)}}
}

