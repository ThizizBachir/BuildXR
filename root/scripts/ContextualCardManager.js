import * as THREE from 'three';

export class ContextualCardManager {
    constructor(scene, camera, gui = null) {
        this.scene = scene;
        this.camera = camera;
        this.gui = gui;
        
        // Store tracked objects and their associated cards
        this.trackedObjects = new Map(); // key: objectId, value: { object3D, card, metadata }
        
        // Configuration
        this.config = {
            proximityThreshold: 2.0, // 2 meters - distance to trigger card visibility
            cardWidth: 1.0,
            cardHeight: 0.6,
            cardDepth: 0.05,
            cardOffsetY: 1.5, // Y offset above object
            cardOffsetZ: 0.5, // Z offset from object
            updateFrequency: 60, // Hz - how often to check proximity
            showDebug: false
        };

        this.lastUpdateTime = 0;
        this.updateInterval = 1 / this.config.updateFrequency;

        // Setup GUI if available
        if (this.gui) {
            this.setupGUI();
        }
    }

    /**
     * Register an object and its instruction card
     * @param {THREE.Object3D} object3D - The 3D object to track
     * @param {Object} cardData - Card configuration { title, instructions, imageUrl }
     * @param {string} objectId - Unique identifier for the object
     */
    registerObject(object3D, cardData, objectId = null) {
        const id = objectId || `object_${Date.now()}_${Math.random()}`;
        
        // Create the instruction card mesh
        const card = this.createInstructionCard(cardData);
        
        // Position card above the object
        this.updateCardPosition(card, object3D);
        
        // Initially hide the card
        card.visible = false;
        this.scene.add(card);

        // Store tracking information
        this.trackedObjects.set(id, {
            object3D: object3D,
            card: card,
            metadata: cardData,
            isVisible: false,
            distance: Infinity
        });

        console.log(`Registered object: ${id}`);
        return id;
    }

    /**
     * Unregister an object and remove its card
     */
    unregisterObject(objectId) {
        const tracked = this.trackedObjects.get(objectId);
        if (tracked) {
            this.scene.remove(tracked.card);
            this.trackedObjects.delete(objectId);
            console.log(`Unregistered object: ${objectId}`);
        }
    }

    /**
     * Create an instruction card mesh
     */
    createInstructionCard(cardData) {
        // Create card container group
        const cardGroup = new THREE.Group();

        // Background plane
        const bgGeometry = new THREE.PlaneGeometry(
            this.config.cardWidth,
            this.config.cardHeight
        );
        const bgMaterial = new THREE.MeshStandardMaterial({
            color: 0xFFFFFF,
            emissive: 0x222222,
            metalness: 0.1,
            roughness: 0.8,
            side: THREE.DoubleSide
        });
        const background = new THREE.Mesh(bgGeometry, bgMaterial);
        background.position.z = -this.config.cardDepth / 2;
        cardGroup.add(background);

        // Border frame
        const borderGeometry = new THREE.EdgesGeometry(bgGeometry);
        const borderMaterial = new THREE.LineBasicMaterial({ 
            color: 0x000000,
            linewidth: 2
        });
        const border = new THREE.LineSegments(borderGeometry, borderMaterial);
        border.position.z = 0.001; // Slightly offset to avoid z-fighting
        cardGroup.add(border);

        // Create canvas texture for text
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 307;
        
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw title
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(cardData.title || 'Instruction', 256, 60);

        // Draw instructions
        ctx.font = '24px Arial';
        ctx.textAlign = 'left';
        const instructions = cardData.instructions || 'Follow the steps on this card';
        const words = instructions.split(' ');
        let line = '';
        let lineY = 120;

        for (let i = 0; i < words.length; i++) {
            const testLine = line + words[i] + ' ';
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width > 400) {
                ctx.fillText(line, 30, lineY);
                line = words[i] + ' ';
                lineY += 40;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, 30, lineY);

        // Apply canvas as texture
        const texture = new THREE.CanvasTexture(canvas);
        const textMaterial = new THREE.MeshStandardMaterial({
            map: texture,
            emissive: 0xFFFFFF,
            emissiveIntensity: 0.8
        });
        const textMesh = new THREE.Mesh(bgGeometry, textMaterial);
        textMesh.position.z = 0.001;
        cardGroup.add(textMesh);

        // Store metadata on the mesh
        cardGroup.userData = {
            cardData: cardData,
            isInstructionCard: true
        };

        return cardGroup;
    }

    /**
     * Update card position relative to object
     */
    updateCardPosition(card, targetObject) {
        // Position card above and in front of the object
        const objectPos = new THREE.Vector3();
        targetObject.getWorldPosition(objectPos);

        card.position.copy(objectPos);
        card.position.y += this.config.cardOffsetY;
        card.position.z += this.config.cardOffsetZ;

        // Make card face the camera
        card.lookAt(this.camera.position);
    }

    /**
     * Update proximity check and card visibility
     * Call this in your main update loop
     */
    /**
     * Main update loop - checks proximity and updates card visibility
     * Now also considers hand position if hand detection is available
     */
    update(deltaTime) {
        this.lastUpdateTime += deltaTime;

        // Only check proximity at specified frequency
        if (this.lastUpdateTime < this.updateInterval) {
            return;
        }

        this.lastUpdateTime = 0;

        // Get hand gesture manager if available for hand-based proximity
        const handGestureManager = window.app?.handGestureManager;
        const handsData = handGestureManager?.getHandsPosition?.();

        // Check each tracked object
        this.trackedObjects.forEach((tracked, objectId) => {
            // Calculate distance from camera
            const cameraDistance = this.calculateDistance(
                this.camera.position,
                tracked.object3D.getWorldPosition(new THREE.Vector3())
            );

            tracked.distance = cameraDistance;

            // Check camera-based proximity
            let shouldBeVisible = cameraDistance <= this.config.proximityThreshold;

            // Also check hand-based proximity if hands are detected
            // (This is a simple trigger; could be enhanced with proper hand-to-object distance)
            if (handsData && (handsData.right?.detected || handsData.left?.detected)) {
                // If hand is detected, show cards at slightly larger distance
                shouldBeVisible = shouldBeVisible || cameraDistance <= (this.config.proximityThreshold * 1.5);
                
                if (shouldBeVisible) {
                    console.log(`[Contextual] Card triggered by hand proximity: ${objectId}`);
                }
            }

            // Update visibility if changed
            if (shouldBeVisible !== tracked.isVisible) {
                tracked.card.visible = shouldBeVisible;
                tracked.isVisible = shouldBeVisible;

                if (shouldBeVisible) {
                    console.log(`Card visible for object: ${objectId} (distance: ${cameraDistance.toFixed(2)}m)`);
                } else {
                    console.log(`Card hidden for object: ${objectId} (distance: ${cameraDistance.toFixed(2)}m)`);
                }
            }

            // Update card position to face camera (billboard effect)
            if (tracked.isVisible) {
                this.updateCardPosition(tracked.card, tracked.object3D);
            }

            // Debug visualization
            if (this.config.showDebug) {
                this.drawDebugVisualization(tracked.object3D, tracked.isVisible, cameraDistance);
            }
        });
    }

    /**
     * Calculate distance between two positions
     */
    calculateDistance(pos1, pos2) {
        return pos1.distanceTo(pos2);
    }

    /**
     * Draw debug visualization for proximity sphere
     */
    drawDebugVisualization(object3D, isVisible, distance) {
        // This is a helper for debugging - visualizes proximity zone
        const objectPos = object3D.getWorldPosition(new THREE.Vector3());
        
        // You can visualize the proximity sphere by drawing a wireframe sphere
        // This would require additional setup, so leaving as placeholder
        console.debug(`Object at ${objectPos.x.toFixed(2)}, ${objectPos.y.toFixed(2)}, ${objectPos.z.toFixed(2)} - Distance: ${distance.toFixed(2)}m - Visible: ${isVisible}`);
    }

    /**
     * Get all visible cards
     */
    getVisibleCards() {
        const visibleCards = [];
        this.trackedObjects.forEach((tracked) => {
            if (tracked.isVisible) {
                visibleCards.push(tracked);
            }
        });
        return visibleCards;
    }

    /**
     * Get card by object ID
     */
    getCardByObjectId(objectId) {
        return this.trackedObjects.get(objectId);
    }

    /**
     * Update card content
     */
    updateCardContent(objectId, cardData) {
        const tracked = this.trackedObjects.get(objectId);
        if (tracked) {
            tracked.metadata = cardData;
            // Remove old card and create new one
            this.scene.remove(tracked.card);
            const newCard = this.createInstructionCard(cardData);
            this.updateCardPosition(newCard, tracked.object3D);
            newCard.visible = tracked.isVisible;
            this.scene.add(newCard);
            tracked.card = newCard;
        }
    }

    /**
     * Setup GUI controls
     */
    setupGUI() {
        const cardFolder = this.gui.addFolder('Contextual Cards');
        
        cardFolder.add(this.config, 'proximityThreshold', 0.5, 10, 0.5)
            .name('Proximity Threshold (m)')
            .listen();
        
        cardFolder.add(this.config, 'cardOffsetY', 0, 5, 0.1)
            .name('Card Offset Y')
            .listen();
        
        cardFolder.add(this.config, 'cardOffsetZ', -2, 2, 0.1)
            .name('Card Offset Z')
            .listen();
        
        cardFolder.add(this.config, 'updateFrequency', 10, 120, 10)
            .name('Update Frequency (Hz)')
            .onChange((value) => {
                this.updateInterval = 1 / value;
            })
            .listen();
        
        cardFolder.add(this.config, 'showDebug')
            .name('Show Debug Info')
            .listen();
    }

    /**
     * Clear all tracked objects and cards
     */
    clear() {
        this.trackedObjects.forEach((tracked) => {
            this.scene.remove(tracked.card);
        });
        this.trackedObjects.clear();
    }

    /**
     * Cleanup resources
     */
    dispose() {
        this.clear();
    }
}
