import * as THREE from 'three';

export class VisibilityManager {
    constructor(meshGroupLoader, scene) {
        this.meshGroupLoader = meshGroupLoader;
        this.scene = scene;
        this.allBaseMeshNames = [];
        this.allAssembledGroupNames = [];
        this.originalPositions = new Map();
    }

    initialize() {
        this.allBaseMeshNames = this.meshGroupLoader.getBaseNames();
        this.allAssembledGroupNames = this.meshGroupLoader.getAssembledGroupNames();
        
        this.allBaseMeshNames.forEach(name => {
            const meshes = this.meshGroupLoader.getMeshes(name);
            if (meshes) {
                meshes.forEach(mesh => {
                    this.originalPositions.set(mesh.uuid, mesh.position.clone());
                });
            }
        });
        
        console.log('VisibilityManager: Initialized with', 
            this.allBaseMeshNames.length, 'base meshes and',
            this.allAssembledGroupNames.length, 'assembled groups');
    }

    async showOnlyStepMeshes(step) {
        const involvedBaseMeshes = step.involved?.baseMeshes || [];
        const involvedAssembledGroups = step.involved?.assembledGroups || [];

        const allInvolvedMeshes = [];

        involvedBaseMeshes.forEach(name => {
            const meshes = this.meshGroupLoader.getMeshes(name);
            if (meshes) {
                allInvolvedMeshes.push(...meshes);
            }
        });

        involvedAssembledGroups.forEach(name => {
            const meshes = this.meshGroupLoader.getAssembledGroupMeshes(name);
            if (meshes) {
                allInvolvedMeshes.push(...meshes);
            }
        });

        console.log(`VisibilityManager: Processing ${allInvolvedMeshes.length} meshes for step ${step.id}`);

        await new Promise(resolve => setTimeout(resolve, 2000));

        const involvedSet = new Set(allInvolvedMeshes);
        this.allBaseMeshNames.forEach(name => {
            const meshes = this.meshGroupLoader.getMeshes(name);
            if (meshes) {
                meshes.forEach(mesh => {
                    mesh.visible = involvedSet.has(mesh);
                });
            }
        });

        // Wait 0.5 seconds after hiding meshes before starting translation
        await new Promise(resolve => setTimeout(resolve, 500));

        if (allInvolvedMeshes.length > 0) {
            await this._centerMeshesAtOrigin(allInvolvedMeshes);
        }

        console.log(`VisibilityManager: Centered and showing ${allInvolvedMeshes.length} meshes`);
    }

    async _centerMeshesAtOrigin(meshes) {
        const boundingBox = new THREE.Box3();
        
        // Calculate bounding box for all meshes
        meshes.forEach(mesh => {
            const meshBox = new THREE.Box3().setFromObject(mesh);
            boundingBox.union(meshBox);
        });

        const center = new THREE.Vector3();
        boundingBox.getCenter(center);

        // Calculate offset for translation
        const offset = center.clone().negate();
        console.log(`VisibilityManager: Calculated offset (${offset.x.toFixed(2)}, ${offset.y.toFixed(2)}, ${offset.z.toFixed(2)})`);
        
        // Store start positions and calculate target positions
        const animations = meshes.map(mesh => {
            const startWorldPos = new THREE.Vector3();
            mesh.getWorldPosition(startWorldPos);
            
            const targetWorldPos = startWorldPos.clone().add(offset);
            
            // Convert target world position to local position
            let targetLocalPos = targetWorldPos.clone();
            if (mesh.parent) {
                const parentMatrixInverse = new THREE.Matrix4().copy(mesh.parent.matrixWorld).invert();
                targetLocalPos.applyMatrix4(parentMatrixInverse);
            }
            
            return {
                mesh,
                startPos: mesh.position.clone(),
                targetPos: targetLocalPos
            };
        });
        
        // Animate over 1.5 seconds
        const duration = 1500; // milliseconds
        const startTime = Date.now();
        
        return new Promise(resolve => {
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Ease-in-out function for smooth animation
                const eased = progress < 0.5
                    ? 2 * progress * progress
                    : 1 - Math.pow(-2 * progress + 2, 2) / 2;
                
                // Update mesh positions
                animations.forEach(({ mesh, startPos, targetPos }) => {
                    mesh.position.lerpVectors(startPos, targetPos, eased);
                });
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    console.log(`VisibilityManager: Animation complete - translated ${meshes.length} meshes`);
                    resolve();
                }
            };
            
            animate();
        });
    }

    showAll() {
        this.allBaseMeshNames.forEach(name => {
            this.meshGroupLoader.setGroupVisibility(name, true);
        });
        console.log('VisibilityManager: All meshes visible');
    }

    hideAll() {
        this.allBaseMeshNames.forEach(name => {
            this.meshGroupLoader.setGroupVisibility(name, false);
        });
        console.log('VisibilityManager: All meshes hidden');
    }

    resetPositions() {
        this.allBaseMeshNames.forEach(name => {
            const meshes = this.meshGroupLoader.getMeshes(name);
            if (meshes) {
                meshes.forEach(mesh => {
                    const originalPos = this.originalPositions.get(mesh.uuid);
                    if (originalPos) {
                        mesh.position.copy(originalPos);
                    }
                });
            }
        });
        console.log('VisibilityManager: Reset all mesh positions');
    }
}
