import * as THREE from 'three';

export class VisibilityManager {
    constructor(meshGroupLoader, scene) {
        this.meshGroupLoader = meshGroupLoader;
        this.scene = scene;
        this.allBaseMeshNames = [];
        this.allAssembledGroupNames = [];
        this.originalPositions = new Map();
        this.originalMaterialProps = new Map();
    }

    initialize() {
        this.allBaseMeshNames = this.meshGroupLoader.getBaseNames();
        this.allAssembledGroupNames = this.meshGroupLoader.getAssembledGroupNames();
        
        this.allBaseMeshNames.forEach(name => {
            const meshes = this.meshGroupLoader.getMeshes(name);
            if (meshes) {
                meshes.forEach(mesh => {
                    this.originalPositions.set(mesh.uuid, mesh.position.clone());
                    
                    // Clone materials so each mesh has its own instance for independent opacity control
                    if (mesh.material) {
                        if (Array.isArray(mesh.material)) {
                            mesh.material = mesh.material.map(mat => mat.clone());
                        } else {
                            mesh.material = mesh.material.clone();
                        }
                        
                        // Store original material properties for fade restoration
                        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                        const materialProps = materials.map(mat => ({
                            transparent: mat.transparent,
                            opacity: mat.opacity
                        }));
                        this.originalMaterialProps.set(mesh.uuid, materialProps);
                    }
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

        // Fade out non-involved meshes
        await this._fadeOutNonInvolved(allInvolvedMeshes);

        // Wait 0.5 seconds after hiding meshes before starting translation
        await new Promise(resolve => setTimeout(resolve, 500));

        if (allInvolvedMeshes.length > 0) {
            await this._centerMeshesAtOrigin(allInvolvedMeshes);
        }

        console.log(`VisibilityManager: Centered and showing ${allInvolvedMeshes.length} meshes`);
    }

    async _fadeOutNonInvolved(involvedMeshes) {
        const involvedSet = new Set(involvedMeshes);
        const meshesToFade = [];
        
        // Collect all meshes that need to fade out
        this.allBaseMeshNames.forEach(name => {
            const meshes = this.meshGroupLoader.getMeshes(name);
            if (meshes) {
                meshes.forEach(mesh => {
                    if (!involvedSet.has(mesh)) {
                        meshesToFade.push(mesh);
                        // Enable transparency for fade effect
                        if (mesh.material) {
                            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                            materials.forEach(mat => {
                                mat.transparent = true;
                            });
                        }
                    }
                });
            }
        });
        
        // Animate fade out over 500ms
        const duration = 500;
        const startTime = Date.now();
        
        return new Promise(resolve => {
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Fade from 1 to 0
                const opacity = 1 - progress;
                
                meshesToFade.forEach(mesh => {
                    if (mesh.material) {
                        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                        materials.forEach(mat => {
                            mat.opacity = opacity;
                        });
                    }
                });
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    // Hide meshes completely after fade
                    meshesToFade.forEach(mesh => {
                        mesh.visible = false;
                    });
                    console.log(`VisibilityManager: Faded out ${meshesToFade.length} meshes`);
                    resolve();
                }
            };
            
            animate();
        });
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

    async showAll() {
        const allMeshes = [];
        const meshAnimations = [];
        
        // Collect all meshes, restore visibility, and prepare animations
        this.allBaseMeshNames.forEach(name => {
            const meshes = this.meshGroupLoader.getMeshes(name);
            if (meshes) {
                meshes.forEach(mesh => {
                    mesh.visible = true;
                    allMeshes.push(mesh);
                    
                    if (mesh.material) {
                        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                        const originalProps = this.originalMaterialProps.get(mesh.uuid) || [];
                        
                        // Store starting opacity and target opacity for each material
                        const matAnimations = materials.map((mat, idx) => {
                            const original = originalProps[idx] || { transparent: false, opacity: 1 };
                            return {
                                material: mat,
                                startOpacity: mat.opacity,
                                targetOpacity: original.opacity,
                                targetTransparent: original.transparent
                            };
                        });
                        
                        meshAnimations.push({ mesh, matAnimations });
                        
                        // Enable transparency for animation
                        materials.forEach(mat => {
                            mat.transparent = true;
                        });
                    }
                });
            }
        });
        
        // Fade in over 300ms
        const duration = 300;
        const startTime = Date.now();
        
        return new Promise(resolve => {
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                meshAnimations.forEach(({ matAnimations }) => {
                    matAnimations.forEach(({ material, startOpacity, targetOpacity }) => {
                        material.opacity = startOpacity + (targetOpacity - startOpacity) * progress;
                    });
                });
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    // Restore original material properties
                    meshAnimations.forEach(({ matAnimations }) => {
                        matAnimations.forEach(({ material, targetOpacity, targetTransparent }) => {
                            material.opacity = targetOpacity;
                            material.transparent = targetTransparent;
                        });
                    });
                    console.log('VisibilityManager: All meshes visible');
                    resolve();
                }
            };
            
            animate();
        });
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
