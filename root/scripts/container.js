        // ==========================================
        // COMMIT 1: Core classes (Container & Node)
        // ==========================================

        /**
         * Abstract Base Class: SceneNode
         * Wraps a THREE.Object3D to provide a unified interface for logic.
         */
        export class SceneNode {
            constructor(name) {
                this.name = name;
                this.uuid = crypto.randomUUID();
                this.parent = null;
                
                // The native Three.js object. 
                // In a pure container, this might be a Group. In a leaf, a Mesh.
                this.object3D = new THREE.Group(); 
                this.object3D.name = name;
            }

            /**
             * Sets the local position.
             */
            setPosition(x, y, z) {
                this.object3D.position.set(x, y, z);
                return this;
            }

            /**
             * Virtual method to be overridden by subclasses.
             * @param {number} delta - Time elapsed since last frame
             * @param {number} time - Total running time
             */
            update(delta, time) {
                // Base implementation does nothing
            }

            /**
             * Helper to get the native Three object
             */
            getNative() {
                return this.object3D;
            }
        }

        /**
         * Composite Class: SceneContainer
         * Can hold other Nodes (Containers or Entities).
         */
        export class SceneContainer extends SceneNode {
            constructor(name) {
                super(name);
                this.children = [];
                this.type = 'Container';
            }

            add(node) {
                if (!(node instanceof SceneNode)) {
                    console.error("SceneContainer can only hold SceneNodes");
                    return;
                }

                // 1. Add to logical hierarchy
                this.children.push(node);
                node.parent = this;

                // 2. Add to Three.js render graph
                this.object3D.add(node.getNative());
                
                return this; // Chainable
            }

            remove(node) {
                const index = this.children.indexOf(node);
                if (index > -1) {
                    this.children.splice(index, 1);
                    node.parent = null;
                    this.object3D.remove(node.getNative());
                }
            }

            // The recursive update magic
            update(delta, time) {
                // 1. Update self (if needed)
                this.onUpdate(delta, time);

                // 2. Propagate update to all children
                for (const child of this.children) {
                    child.update(delta, time);
                }
            }

            // Hook for custom logic on the container itself (e.g., spinning the whole group)
            onUpdate(delta, time) {}
        }

        // ==========================================
        // COMMIT 2: leaf implimentation
        // ==========================================

        /**
         * Leaf Class: MeshEntity
         * Represents a visible object in the scene.
         */
        export class MeshEntity extends SceneNode {
            constructor(name, geometry, material) {
                super(name);
                this.type = 'Mesh';
                
                // Replace the default Group with the actual Mesh
                this.object3D = new THREE.Mesh(geometry, material);
                this.object3D.name = name;
                this.object3D.castShadow = true;
                this.object3D.receiveShadow = true;
            }

            // Specific logic for a Mesh
            update(delta, time) {
                // Example: We can add custom per-frame logic here
                // For this demo, we'll let the custom behavior be injected or handled via subclassing
                // But typically, game logic goes here (collision checks, etc.)
            }
            
            // Example method specific to Meshes
            setColor(hex) {
                this.object3D.material.color.setHex(hex);
            }
        }

        /**
         * A specific type of MeshEntity that rotates on its own axis.
         * Demonstrating how to extend the leaf for behavior.
         */
        export class RotatorEntity extends MeshEntity {
            constructor(name, geometry, material, speed = 1) {
                super(name, geometry, material);
                this.speed = speed;
            }

            update(delta, time) {
                this.object3D.rotation.y += this.speed * delta;
                this.object3D.rotation.z += (this.speed * 0.5) * delta;
            }
        }