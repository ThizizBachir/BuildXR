import * as THREE from 'three';

/**
 * Manages assembly animations for individual meshes
 * Reads animation configurations and applies directional movements
 */
export class AssemblyAnimator {
    constructor(meshGroupLoader) {
        this.meshGroupLoader = meshGroupLoader;
        this.animationConfig = null;
        this.animationOffsets = new Map(); // Store offset positions for each mesh
        this.animationClones = new Map(); // Store cloned meshes for animation
        this.scene = null; // Will be set when needed
    }

    /**
     * Load animation configuration from JSON
     * @param {string} jsonPath - Path to the animation config JSON
     */
    async initialize(jsonPath) {
        try {
            const response = await fetch(jsonPath);
            this.animationConfig = await response.json();
            console.log('AssemblyAnimator: Loaded animation config with', 
                Object.keys(this.animationConfig).length, 'steps');
            return this.animationConfig;
        } catch (error) {
            console.error('AssemblyAnimator: Failed to load config:', error);
            throw error;
        }
    }

    /**
     * Parse direction string to vector
     * @param {string} direction - Direction string (+X, -X, +Y, -Y, +Z, -Z)
     * @returns {THREE.Vector3} Direction vector
     */
    _parseDirection(direction) {
        const directionMap = {
            '+X': new THREE.Vector3(1, 0, 0),
            '-X': new THREE.Vector3(-1, 0, 0),
            '+Y': new THREE.Vector3(0, 1, 0),
            '-Y': new THREE.Vector3(0, -1, 0),
            '+Z': new THREE.Vector3(0, 0, 1),
            '-Z': new THREE.Vector3(0, 0, -1)
        };
        return directionMap[direction] || new THREE.Vector3(0, 0, 0);
    }

    /**
     * Get meshes from a base name or assembled group (expands numbered variants)
     * @param {THREE.Object3D} droneModel - The drone model
     * @param {string} baseName - Base name or assembled group name to expand
     * @returns {THREE.Mesh[]} Array of meshes
     */
    _getMeshesByName(droneModel, baseName) {
        // First try to get from mesh group loader as base mesh
        if (this.meshGroupLoader) {
            const groupMeshes = this.meshGroupLoader.getMeshes(baseName);
            if (groupMeshes && groupMeshes.length > 0) {
                return groupMeshes;
            }
            
            // Try as assembled group
            const assembledMeshes = this.meshGroupLoader.getAssembledGroupMeshes(baseName);
            if (assembledMeshes && assembledMeshes.length > 0) {
                return assembledMeshes;
            }
        }

        // Fallback: search directly in model
        const meshes = [];
        droneModel.traverse(child => {
            if (child.isMesh && child.name === baseName) {
                meshes.push(child);
            }
        });
        return meshes;
    }

    /**
     * Create clones for animation (original meshes stay at center with outline)
     * @param {Object} stepAnimation - Animation config for the step
     * @param {THREE.Object3D} droneModel - The drone model
     * @param {THREE.Scene} scene - The scene to add clones to
     */
    createAnimationClones(stepAnimation, droneModel, scene) {
        if (!stepAnimation || !stepAnimation.animations) return;
        
        this.scene = scene;
        this.clearClones(); // Clear any existing clones

        stepAnimation.animations.forEach(animConfig => {
            const meshes = this._getMeshesByName(droneModel, animConfig.mesh);
            const direction = this._parseDirection(animConfig.direction);
            const offset = animConfig.offset || 0.5;

            meshes.forEach(mesh => {
                // Clone the mesh
                const clone = mesh.clone();
                
                // Clone materials to avoid shared material issues
                if (clone.material) {
                    if (Array.isArray(clone.material)) {
                        clone.material = clone.material.map(mat => mat.clone());
                    } else {
                        clone.material = clone.material.clone();
                    }
                }
                
                // Position clone at offset position (opposite direction)
                const offsetVector = direction.clone().multiplyScalar(-offset);
                clone.position.copy(mesh.position).add(offsetVector);
                
                // Make clone invisible initially
                clone.visible = false;
                if (clone.material) {
                    const materials = Array.isArray(clone.material) ? clone.material : [clone.material];
                    materials.forEach(mat => {
                        mat.transparent = true;
                        mat.opacity = 0;
                    });
                }
                
                // Add clone to scene
                if (mesh.parent) {
                    mesh.parent.add(clone);
                } else {
                    scene.add(clone);
                }
                
                // Store animation data
                this.animationOffsets.set(clone.uuid, {
                    originalMesh: mesh,
                    targetPosition: mesh.position.clone(),
                    direction: direction,
                    offset: offset
                });
                
                this.animationClones.set(mesh.uuid, clone);
            });
        });

        console.log(`AssemblyAnimator: Created ${this.animationClones.size} animation clones`);
    }

    /**
     * Animate cloned meshes moving to their centered positions (one by one sequentially)
     * @param {string} stepId - Step ID
     * @param {THREE.Object3D} droneModel - The drone model
     */
    async playAssemblyAnimation(stepId, droneModel) {
        const stepAnimation = this.animationConfig?.[stepId];
        if (!stepAnimation || !stepAnimation.animations) {
            console.warn(`AssemblyAnimator: No animation config for step ${stepId}`);
            return;
        }

        console.log(`AssemblyAnimator: Playing assembly animation for ${stepId} (sequential)`);

        // Animate each mesh group one by one (sequentially)
        for (const animConfig of stepAnimation.animations) {
            const meshes = this._getMeshesByName(droneModel, animConfig.mesh);
            const duration = (animConfig.duration || 1.0) * 1000; // Convert to ms
            
            // Get clones for these meshes and animate them
            const meshPromises = meshes.map(mesh => {
                const clone = this.animationClones.get(mesh.uuid);
                if (clone) {
                    return this._animateCloneToTarget(clone, duration);
                }
                return Promise.resolve();
            });

            // Wait for this group to complete before moving to the next
            await Promise.all(meshPromises);
        }

        console.log(`AssemblyAnimator: Completed assembly animation for ${stepId}`);
    }

    /**
     * Animate a cloned mesh from offset position to target position
     * @param {THREE.Mesh} clone - The cloned mesh to animate
     * @param {number} duration - Animation duration in milliseconds
     */
    async _animateCloneToTarget(clone, duration) {
        const offsetData = this.animationOffsets.get(clone.uuid);
        if (!offsetData) {
            console.warn('AssemblyAnimator: No offset data for clone', clone.name);
            return;
        }

        const startPosition = clone.position.clone();
        const targetPosition = offsetData.targetPosition.clone();
        const startTime = Date.now();

        // Make clone visible and start fade in
        clone.visible = true;

        return new Promise(resolve => {
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Ease-in-out interpolation
                const eased = progress < 0.5 
                    ? 2 * progress * progress 
                    : 1 - Math.pow(-2 * progress + 2, 2) / 2;

                // Update position
                clone.position.lerpVectors(startPosition, targetPosition, eased);

                // Fade in opacity
                if (clone.material) {
                    const materials = Array.isArray(clone.material) ? clone.material : [clone.material];
                    materials.forEach(mat => {
                        mat.opacity = eased;
                    });
                }

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    // Animation complete - hide clone and show original
                    clone.visible = false;
                    if (offsetData.originalMesh) {
                        offsetData.originalMesh.visible = true;
                        // Restore original mesh opacity
                        if (offsetData.originalMesh.material) {
                            const materials = Array.isArray(offsetData.originalMesh.material) 
                                ? offsetData.originalMesh.material 
                                : [offsetData.originalMesh.material];
                            materials.forEach(mat => {
                                mat.opacity = 1;
                            });
                        }
                    }
                    resolve();
                }
            };

            animate();
        });
    }

    /**
     * Clear all animation clones from the scene
     */
    clearClones() {
        this.animationClones.forEach((clone, meshUuid) => {
            if (clone.parent) {
                clone.parent.remove(clone);
            }
            // Dispose geometry and materials
            if (clone.geometry) clone.geometry.dispose();
            if (clone.material) {
                const materials = Array.isArray(clone.material) ? clone.material : [clone.material];
                materials.forEach(mat => mat.dispose());
            }
        });
        this.animationClones.clear();
        this.animationOffsets.clear();
        console.log('AssemblyAnimator: Cleared all animation clones');
    }

    /**
     * Clear all animation offsets (deprecated - use clearClones)
     */
    clearOffsets() {
        this.clearClones();
    }
}
