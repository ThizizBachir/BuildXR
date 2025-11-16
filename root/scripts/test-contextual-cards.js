import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as GUI from 'lilGUI';
import { ContextualCardManager } from './ContextualCardManager.js';

class ContextualCardsTest {
    constructor() {
        this.setupScene();
        this.setupCamera();
        this.setupRenderer();
        this.setupControls();
        this.setupGUI();
        this.setupLighting();
        this.createTestObjects();
        this.contextualCardManager = new ContextualCardManager(this.scene, this.camera, this.gui);
        this.registerTestCards();
        this.setupEventListeners();
        this.startRenderLoop();
    }

    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a1a);
        
        // Add grid
        const gridHelper = new THREE.GridHelper(50, 50, 0x444444, 0x222222);
        this.scene.add(gridHelper);
    }

    setupCamera() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        this.camera.position.set(0, 3, 8);
        this.camera.lookAt(0, 0, 0);
    }

    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);

        // Handle window resize
        window.addEventListener('resize', () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        });
    }

    setupControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enableZoom = true;
    }

    setupGUI() {
        this.gui = new GUI.GUI();
    }

    setupLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        // Directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);
    }

    createTestObjects() {
        this.testObjects = [];

        // Test Object 1: Red Cube
        const geometry1 = new THREE.BoxGeometry(1, 1, 1);
        const material1 = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        const cube = new THREE.Mesh(geometry1, material1);
        cube.position.set(-4, 0.5, -2);
        cube.castShadow = true;
        this.scene.add(cube);
        this.testObjects.push({ mesh: cube, id: 'cube_red' });

        // Test Object 2: Green Sphere
        const geometry2 = new THREE.SphereGeometry(0.8, 32, 32);
        const material2 = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        const sphere = new THREE.Mesh(geometry2, material2);
        sphere.position.set(0, 0.8, 0);
        sphere.castShadow = true;
        this.scene.add(sphere);
        this.testObjects.push({ mesh: sphere, id: 'sphere_green' });

        // Test Object 3: Blue Cylinder
        const geometry3 = new THREE.CylinderGeometry(0.6, 0.6, 1.5, 32);
        const material3 = new THREE.MeshStandardMaterial({ color: 0x0000ff });
        const cylinder = new THREE.Mesh(geometry3, material3);
        cylinder.position.set(4, 0.75, -2);
        cylinder.castShadow = true;
        this.scene.add(cylinder);
        this.testObjects.push({ mesh: cylinder, id: 'cylinder_blue' });

        // Test Object 4: Yellow Torus
        const geometry4 = new THREE.TorusGeometry(1, 0.4, 16, 100);
        const material4 = new THREE.MeshStandardMaterial({ color: 0xffff00 });
        const torus = new THREE.Mesh(geometry4, material4);
        torus.position.set(0, 1, 4);
        torus.rotation.x = Math.PI / 4;
        torus.castShadow = true;
        this.scene.add(torus);
        this.testObjects.push({ mesh: torus, id: 'torus_yellow' });

        // Test Object 5: Purple Cone
        const geometry5 = new THREE.ConeGeometry(0.8, 1.5, 32);
        const material5 = new THREE.MeshStandardMaterial({ color: 0xff00ff });
        const cone = new THREE.Mesh(geometry5, material5);
        cone.position.set(-4, 0.75, 3);
        cone.castShadow = true;
        this.scene.add(cone);
        this.testObjects.push({ mesh: cone, id: 'cone_purple' });

        // Ground plane
        const groundGeometry = new THREE.PlaneGeometry(100, 100);
        const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.5;
        ground.receiveShadow = true;
        this.scene.add(ground);
    }

    registerTestCards() {
        const cardConfigs = [
            {
                id: 'cube_red',
                title: 'Red Cube',
                instructions: 'This is a basic cube geometry. Step closer to see this card appear!'
            },
            {
                id: 'sphere_green',
                title: 'Green Sphere',
                instructions: 'A sphere with 32 segments. Notice how the card always faces the camera!'
            },
            {
                id: 'cylinder_blue',
                title: 'Blue Cylinder',
                instructions: 'A cylinder with the classic blue color. Distance tracking is working!'
            },
            {
                id: 'torus_yellow',
                title: 'Yellow Torus',
                instructions: 'A torus geometry rotated on the X axis. Try moving around to test proximity!'
            },
            {
                id: 'cone_purple',
                title: 'Purple Cone',
                instructions: 'A cone shape demonstrating the contextual card system in action!'
            }
        ];

        cardConfigs.forEach(config => {
            const testObject = this.testObjects.find(obj => obj.id === config.id);
            if (testObject) {
                this.contextualCardManager.registerObject(
                    testObject.mesh,
                    {
                        title: config.title,
                        instructions: config.instructions
                    },
                    config.id
                );
            }
        });

        console.log('Test cards registered:', cardConfigs.length);
    }

    setupEventListeners() {
        // Update distance and card info in UI
        setInterval(() => {
            const visibleCards = this.contextualCardManager.getVisibleCards();
            const cardStatusEl = document.getElementById('card-status');
            const distanceInfoEl = document.getElementById('distance-info');

            if (visibleCards.length > 0) {
                const closestCard = visibleCards[0];
                cardStatusEl.textContent = `Card Status: Visible (${visibleCards.length} card${visibleCards.length > 1 ? 's' : ''} visible)`;
                distanceInfoEl.textContent = `Distance: ${closestCard.distance.toFixed(2)} m`;
            } else {
                cardStatusEl.textContent = `Card Status: Hidden (Move closer to objects)`;
                distanceInfoEl.textContent = `Distance: -- m`;
            }
        }, 100);
    }

    startRenderLoop() {
        let lastTime = 0;

        const animate = (time) => {
            const deltaTime = (time - lastTime) / 1000;
            lastTime = time;

            // Rotate test objects slightly for visual interest
            this.testObjects.forEach(obj => {
                obj.mesh.rotation.x += deltaTime * 0.3;
                obj.mesh.rotation.y += deltaTime * 0.5;
            });

            // Update controls
            this.controls.update();

            // Update contextual cards
            this.contextualCardManager.update(deltaTime);

            // Render
            this.renderer.render(this.scene, this.camera);

            requestAnimationFrame(animate);
        };

        requestAnimationFrame(animate);
    }
}

// Start the test when the page loads
window.addEventListener('load', () => {
    new ContextualCardsTest();
});
