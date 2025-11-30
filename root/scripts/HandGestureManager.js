
export class HandGestureManager {
    constructor(gui = null) {
        this.hands = null;
        this.camera = null;
        this.videoElement = null;
        this.isInitialized = false;
        this.isRunning = false;
        this.gui = gui;
        
        this.trackedHands = {
            left: { detected: false, position: null, confidence: 0 },
            right: { detected: false, position: null, confidence: 0 }
        };
        
        this.gestureCallbacks = {
            handDetected: [],
            handLost: [],
            gestureRecognized: []
        };
        
        this.config = {
            enabled: true,
            confidenceThreshold: 0.5,
            smoothingFactor: 0.7
        };

        this.previousDetection = { left: false, right: false };
    }

    /**
     * Initialize hand gesture tracking
     */
    async initialize() {
        try {
            console.log('[HandGestureManager] Starting initialization...');
            
            if (typeof window.Hands === 'undefined' || typeof window.Camera === 'undefined') {
                throw new Error('MediaPipe not available. Check CDN scripts loaded.');
            }
            console.log('[HandGestureManager] ✓ MediaPipe Hands available');

            // Step 2: Request camera permission
            console.log('[HandGestureManager] Requesting camera access...');
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            console.log('[HandGestureManager] ✓ Camera permission granted');

            // Step 3: Create video element
            this.videoElement = document.createElement('video');
            this.videoElement.srcObject = stream;
            this.videoElement.setAttribute('autoplay', '');
            this.videoElement.setAttribute('muted', '');
            this.videoElement.setAttribute('playsinline', '');
            this.videoElement.style.display = 'none'; // Hidden from view
            
            // IMPORTANT: Must add to DOM for proper playback
            document.body.appendChild(this.videoElement);
            
            // Wait for video to be ready
            await new Promise(resolve => {
                const checkReady = () => {
                    if (this.videoElement.readyState >= 2) {
                        resolve();
                    } else {
                        requestAnimationFrame(checkReady);
                    }
                };
                checkReady();
            });
            console.log('[HandGestureManager] ✓ Video stream ready');

            // Step 4: Initialize MediaPipe Hands (use locateFile to ensure assets load from CDN)
            console.log('[HandGestureManager] Initializing Hands...');
            try {
                const locateFile = (file) => {
                    // Ensure correct CDN path for the current mediapipe package
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
                };

                this.hands = new window.Hands({
                    locateFile,
                });

                // Default options (tunable)
                this.hands.setOptions({
                    maxNumHands: 2,
                    modelComplexity: 1,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5
                });

                this.hands.onResults((results) => this.onHandsResults(results));
                console.log('[HandGestureManager] ✓ Hands initialized');
            } catch (err) {
                console.error('[HandGestureManager] ✗ Failed to initialize Hands:', err && err.message ? err.message : err);
                throw err;
            }

            // Step 5: Initialize Camera (handles frame sending)
            console.log('[HandGestureManager] Setting up camera helper...');
            // If Camera helper exists, use it.
            if (typeof window.Camera === 'function') {
                this.camera = new window.Camera(this.videoElement, {
                    onFrame: async () => {
                        if (!this.isRunning || !this.hands) return;

                        if (typeof this.hands.send !== 'function') {
                            console.error('[HandGestureManager] ✗ hands.send is not a function', this.hands);
                            return;
                        }

                        try {
                            await this.hands.send({ image: this.videoElement });
                        } catch (e) {
                            console.warn('[HandGestureManager] Error sending frame:', e && e.message ? e.message : e);
                        }
                    }
                });
            } else {
                console.warn('[HandGestureManager] Camera helper not available; falling back to manual frame loop');

                // Simple fallback loop that periodically sends frames
                const fallbackLoop = async () => {
                    if (this.isRunning && this.hands) {
                        if (typeof this.hands.send === 'function') {
                            try {
                                await this.hands.send({ image: this.videoElement });
                            } catch (e) {
                                console.warn('[HandGestureManager] Fallback send error:', e && e.message ? e.message : e);
                            }
                        } else {
                            console.error('[HandGestureManager] ✗ hands.send missing in fallback — aborting loop', this.hands);
                            return;
                        }
                    }
                    // Throttle to ~30fps
                    setTimeout(() => requestAnimationFrame(fallbackLoop), 33);
                };

                this.camera = { start: () => { this.isRunning = true; requestAnimationFrame(fallbackLoop); }, stop: () => { this.isRunning = false; } };
            }
            console.log('[HandGestureManager] ✓ Camera helper ready');

            this.isInitialized = true;
            console.log('[HandGestureManager] ✓ Initialization complete!');
            
            if (this.gui) {
                this.setupGUI();
            }

            return true;
        } catch (error) {
            console.error('[HandGestureManager] ✗ Initialization failed:', error.message);
            this.isInitialized = false;
            return false;
        }
    }

    /**
     * Process MediaPipe results
     */
    onHandsResults(results) {
        if (!this.config.enabled || !this.isRunning) {
            return;
        }

        try {
            const newDetection = { left: false, right: false };

            if (results.multiHandLandmarks && results.multiHandedness) {
                results.multiHandLandmarks.forEach((landmarks, idx) => {
                    const handedness = results.multiHandedness[idx];
                    const label = handedness.label.toLowerCase();
                    const score = handedness.score;

                    // Get wrist landmark
                    const wrist = landmarks[0];
                    this.updateHandTracking(label, {
                        x: wrist.x,
                        y: wrist.y,
                        z: wrist.z || 0
                    }, score);

                    newDetection[label] = true;
                });
            } else {
                this.trackedHands.left.detected = false;
                this.trackedHands.right.detected = false;
            }

            // Trigger events
            if (newDetection.left !== this.previousDetection.left || 
                newDetection.right !== this.previousDetection.right) {
                if (newDetection.left || newDetection.right) {
                    this.triggerCallback('handDetected');
                } else {
                    this.triggerCallback('handLost');
                }
            }

            this.previousDetection = newDetection;
        } catch (e) {
            console.warn('[HandGestureManager] Error in onHandsResults:', e.message);
        }
    }

    /**
     * Update hand tracking with smoothing
     */
    updateHandTracking(label, position, confidence) {
        const hand = this.trackedHands[label];
        
        if (hand.position) {
            hand.position.x = hand.position.x * this.config.smoothingFactor + 
                            position.x * (1 - this.config.smoothingFactor);
            hand.position.y = hand.position.y * this.config.smoothingFactor + 
                            position.y * (1 - this.config.smoothingFactor);
            hand.position.z = hand.position.z * this.config.smoothingFactor + 
                            position.z * (1 - this.config.smoothingFactor);
        } else {
            hand.position = { ...position };
        }

        hand.detected = true;
        hand.confidence = Math.max(0, Math.min(1, confidence));
    }

    /**
     * Start hand detection
     */
    start() {
        if (!this.isInitialized) {
            console.warn('[HandGestureManager] Not initialized. Call initialize() first.');
            return false;
        }
        
        this.isRunning = true;
        if (this.camera) {
            this.camera.start();
        }
        console.log('[HandGestureManager] Detection started');
        return true;
    }

    /**
     * Stop hand detection
     */
    stop() {
        this.isRunning = false;
        if (this.camera) {
            this.camera.stop();
        }
        console.log('[HandGestureManager] Detection stopped');
    }

    /**
     * Get hand position
     */
    getHandPosition(handKey = 'right') {
        const hand = this.trackedHands[handKey];
        if (!hand.detected || !hand.position) {
            return null;
        }
        return { ...hand.position, detected: true, confidence: hand.confidence };
    }

    /**
     * Get both hands
     */
    getHandsPosition() {
        return {
            left: this.getHandPosition('left'),
            right: this.getHandPosition('right')
        };
    }

    /**
     * Check if hand detected
     */
    isHandDetected(handKey = 'right') {
        return this.trackedHands[handKey].detected && this.config.enabled;
    }

    /**
     * Register callback
     */
    on(eventName, callback) {
        if (this.gestureCallbacks[eventName]) {
            this.gestureCallbacks[eventName].push(callback);
        }
    }

    /**
     * Trigger callbacks
     */
    triggerCallback(eventName, data = null) {
        if (this.gestureCallbacks[eventName]) {
            this.gestureCallbacks[eventName].forEach(cb => {
                try {
                    cb(data);
                } catch (e) {
                    console.error(`Error in ${eventName} callback:`, e);
                }
            });
        }
    }

    /**
     * Setup GUI
     */
    setupGUI() {
        if (!this.gui) return;
        const folder = this.gui.addFolder('Hand Gesture Detection');
        folder.add(this.config, 'enabled').name('Enabled');
        folder.add(this.config, 'confidenceThreshold', 0, 1, 0.1).name('Confidence');
        folder.add(this, 'start').name('Start');
        folder.add(this, 'stop').name('Stop');
    }

    /**
     * Cleanup
     */
    dispose() {
        this.stop();
        if (this.videoElement && this.videoElement.srcObject) {
            this.videoElement.srcObject.getTracks().forEach(t => t.stop());
            this.videoElement.remove();
        }
        this.isInitialized = false;
    }
}
