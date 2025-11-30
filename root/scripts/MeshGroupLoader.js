import * as THREE from 'three';

/**
 * MeshGroupLoader: Adapter between Blender naming and GLTF numbered mesh variants.
 * Reads a JSON list of base names, discovers all numbered variants
 * (e.g., camera_1, camera_2, ..., camera_N), and creates groups that can be
 * manipulated as single entities.
 */
export class MeshGroupLoader {
    constructor() {
        this.groups = new Map(); // baseName -> { baseName, meshes: [], group: Group3D }
        this.meshGroupConfig = null;
    }

    /**
     * Initialize with a mesh group config JSON.
     * JSON format:
     * {
     *   "baseNames": ["camera", "camera_nut", "+Ymotor", ...]
     * }
     * @param {string} configPath - Path to the mesh groups JSON
     */
    async initialize(configPath) {
        try {
            const response = await fetch(configPath);
            if (!response.ok) throw new Error(`Failed to load mesh groups config: ${response.status}`);
            this.meshGroupConfig = await response.json();
            console.log('MeshGroupLoader: Config loaded', this.meshGroupConfig);
        } catch (error) {
            console.error('MeshGroupLoader: Failed to initialize', error);
            throw error;
        }
    }

    /**
     * Build groups from the loaded GLTF model.
     * For each base name in config, discover all meshes matching baseName or baseName_N.
     * Creates a THREE.Group for each base name containing all discovered meshes.
     * @param {THREE.Object3D} rootModel - The loaded GLTF scene
     */
    buildGroups(rootModel) {
        if (!this.meshGroupConfig) {
            console.warn('MeshGroupLoader: Config not loaded. Call initialize() first.');
            return;
        }

        this.groups.clear();

        this.meshGroupConfig.baseNames.forEach(baseName => {
            const discovered = this._discoverMeshVariants(rootModel, baseName);
            
            if (discovered.length === 0) {
                console.warn(`MeshGroupLoader: No meshes found for base "${baseName}"`);
                return;
            }

            // Create a group (Three.js Group) containing all discovered meshes
            const group = new THREE.Group();
            group.name = baseName;
            
            // Note: meshes remain in their original scene positions; the group is a logical container
            
            this.groups.set(baseName, {
                baseName,
                meshes: discovered,
                group
            });

            console.log(`MeshGroupLoader: Created group "${baseName}" with ${discovered.length} meshes`);
        });
    }

    /**
     * Discover all mesh variants for a given base name.
     * Matches: baseName (exact) and baseName_1, baseName_2, ..., baseName_N.
     * @param {THREE.Object3D} root
     * @param {string} baseName
     * @returns {THREE.Mesh[]}
     * @private
     */
    _discoverMeshVariants(root, baseName) {
        const found = [];
        const regex = new RegExp(`^${this._escapeRegex(baseName)}(_\\d+)?$`);

        root.traverse(child => {
            if (child.isMesh && regex.test(child.name)) {
                found.push(child);
            }
        });

        // Sort by numeric suffix for consistent ordering
        found.sort((a, b) => {
            const aMatch = a.name.match(/_(\d+)$/);
            const bMatch = b.name.match(/_(\d+)$/);
            const aNum = aMatch ? parseInt(aMatch[1]) : 0;
            const bNum = bMatch ? parseInt(bMatch[1]) : 0;
            return aNum - bNum;
        });

        return found;
    }

    /**
     * Escape special regex characters in base name
     * @param {string} str
     * @returns {string}
     * @private
     */
    _escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Get all meshes for a base name group.
     * @param {string} baseName
     * @returns {THREE.Mesh[] | null}
     */
    getMeshes(baseName) {
        const entry = this.groups.get(baseName);
        return entry ? entry.meshes : null;
    }

    /**
     * Get the group (THREE.Group) for a base name.
     * @param {string} baseName
     * @returns {THREE.Group | null}
     */
    getGroup(baseName) {
        const entry = this.groups.get(baseName);
        return entry ? entry.group : null;
    }

    /**
     * Get all base names.
     * @returns {string[]}
     */
    getBaseNames() {
        return Array.from(this.groups.keys());
    }

    /**
     * Apply a transformation to all meshes in a group.
     * @param {string} baseName
     * @param {Function} fn - Callback (mesh) => void
     */
    forEachMesh(baseName, fn) {
        const meshes = this.getMeshes(baseName);
        if (meshes) meshes.forEach(fn);
    }

    /**
     * Set visibility for all meshes in a group.
     * @param {string} baseName
     * @param {boolean} visible
     */
    setGroupVisibility(baseName, visible) {
        this.forEachMesh(baseName, mesh => {
            mesh.visible = visible;
        });
    }

    /**
     * Translate all meshes in a group by an offset.
     * @param {string} baseName
     * @param {THREE.Vector3} offset
     */
    translateGroup(baseName, offset) {
        this.forEachMesh(baseName, mesh => {
            mesh.position.add(offset);
        });
    }

    /**
     * Scale all meshes in a group.
     * @param {string} baseName
     * @param {THREE.Vector3 | number} scale
     */
    scaleGroup(baseName, scale) {
        const scaleVec = typeof scale === 'number' ? new THREE.Vector3(scale, scale, scale) : scale;
        this.forEachMesh(baseName, mesh => {
            mesh.scale.multiply(scaleVec);
        });
    }
}
