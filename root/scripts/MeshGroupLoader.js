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
        this.assembledGroups = new Map(); // groupName -> { name, meshes: [], group: Group3D }
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
            const res = await fetch(configPath);
            if (!res.ok) {
                throw new Error(`Failed to fetch mesh groups config: ${res.status} ${res.statusText}`);
            }
            this.meshGroupConfig = await res.json();

            // Normalize config structure
            if (!this.meshGroupConfig.baseNames) {
                this.meshGroupConfig.baseNames = [];
            }
            if (!this.meshGroupConfig.assembledGroups) {
                this.meshGroupConfig.assembledGroups = [];
            }

            console.log('MeshGroupLoader: Config loaded', this.meshGroupConfig);
        } catch (error) {
            console.error('MeshGroupLoader: Failed to initialize', error);
            throw error;
        }
    }

    /**
     * Build groups from the loaded GLTF model.
     * For each base name in config, discover all meshes matching baseName or baseName_N.
     * Logs warnings if a baseName finds no meshes; logs counts otherwise.
     * Creates a THREE.Group for each base name containing all discovered meshes.
     * Then builds assembled groups from the baseName groups.
     * @param {THREE.Object3D} rootModel - The loaded GLTF scene
     */
    buildGroups(rootModel) {
        if (!this.meshGroupConfig) {
            console.warn('MeshGroupLoader: Config not loaded. Call initialize() first.');
            return;
        }

        this.groups.clear();
        this.assembledGroups.clear();

        // Step 1: Build baseName groups
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

        // Step 2: Build assembled groups from baseName groups
        if (this.meshGroupConfig.assembledGroups) {
            this._buildAssembledGroups();
        }

        // Debug: list built groups
        console.log('MeshGroupLoader: Base groups built:', this.getBaseNames());
        console.log('MeshGroupLoader: Assembled groups built:', this.getAssembledGroupNames());
    }

    /**
     * Build assembled groups by combining meshes from multiple baseName groups.
     * @private
     */
    _buildAssembledGroups() {
        // Build a fast lookup map for assembled configs by name
        const configByName = new Map();
        this.meshGroupConfig.assembledGroups.forEach(c => {
            if (c && c.name) configByName.set(c.name, c);
        });

        const resolvingCache = new Map(); // name -> meshes[] during resolution (prevents infinite loops)
        const finalMeshesCache = new Map(); // name -> flattened unique meshes[]

        const resolveAssembled = (groupName, stack = []) => {
            if (finalMeshesCache.has(groupName)) {
                return finalMeshesCache.get(groupName);
            }
            if (resolvingCache.has(groupName)) {
                // Circular reference detected
                console.warn(`MeshGroupLoader: Circular assembled group reference detected: ${[...stack, groupName].join(' -> ')}`);
                return [];
            }
            const config = configByName.get(groupName);
            if (!config) {
                // Might be a base group name
                const baseMeshes = this.getMeshes(groupName);
                if (!baseMeshes) {
                    console.warn(`MeshGroupLoader: Assembled group reference "${groupName}" not found as assembled or base group`);
                    return [];
                }
                finalMeshesCache.set(groupName, baseMeshes.slice());
                return baseMeshes;
            }

            resolvingCache.set(groupName, []);
            const { baseNames = [], groups = [] } = config;
            const collected = [];

            // Add meshes from baseNames
            baseNames.forEach(baseName => {
                const meshes = this.getMeshes(baseName);
                if (meshes && meshes.length) {
                    collected.push(...meshes);
                } else {
                    console.warn(`MeshGroupLoader: Assembled group "${groupName}" references unknown/empty baseName "${baseName}"`);
                }
            });

            // Add meshes from nested groups (could be base or assembled)
            groups.forEach(refName => {
                const nestedMeshes = resolveAssembled(refName, [...stack, groupName]);
                if (nestedMeshes.length) {
                    collected.push(...nestedMeshes);
                } else {
                    console.warn(`MeshGroupLoader: Assembled group "${groupName}" got zero meshes from nested group "${refName}"`);
                }
            });

            // Deduplicate meshes by UUID
            const unique = [];
            const seen = new Set();
            collected.forEach(m => {
                if (!seen.has(m.uuid)) {
                    seen.add(m.uuid);
                    unique.push(m);
                }
            });

            resolvingCache.delete(groupName);
            finalMeshesCache.set(groupName, unique);
            return unique;
        };

        // Resolve each assembled group definition
        this.meshGroupConfig.assembledGroups.forEach(cfg => {
            const name = cfg.name;
            if (!name) {
                console.warn('MeshGroupLoader: Skipping assembled group with missing name', cfg);
                return;
            }
            const flattenedMeshes = resolveAssembled(name);
            const group = new THREE.Group();
            group.name = name;
            this.assembledGroups.set(name, {
                name,
                meshes: flattenedMeshes,
                group
            });
            console.log(`MeshGroupLoader: Created assembled group "${name}" with ${flattenedMeshes.length} flattened meshes`);
        });

        // Warn if any assembled group ended empty
        this.assembledGroups.forEach(entry => {
            if (!entry.meshes.length) {
                console.warn(`MeshGroupLoader: Assembled group "${entry.name}" is empty after flattening`);
            }
        });
    }

    /**
     * Get all meshes for either a base or assembled group name (flattened).
     * @param {string} name
     * @returns {THREE.Mesh[] | null}
     */
    getAllMeshesForName(name) {
        if (this.groups.has(name)) {
            return this.getMeshes(name);
        }
        if (this.assembledGroups.has(name)) {
            return this.getAssembledGroupMeshes(name);
        }
        return null;
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

    // ========== Assembled Groups Methods ==========

    /**
     * Get all meshes for an assembled group.
     * @param {string} groupName
     * @returns {THREE.Mesh[] | null}
     */
    getAssembledGroupMeshes(groupName) {
        const entry = this.assembledGroups.get(groupName);
        if (!entry) {
            console.warn(`MeshGroupLoader: assembled group not found`, groupName);
            return null;
        }
        return entry.meshes;
    }

    /**
     * Get the THREE.Group for an assembled group.
     * @param {string} groupName
     * @returns {THREE.Group | null}
     */
    getAssembledGroup(groupName) {
        const entry = this.assembledGroups.get(groupName);
        return entry ? entry.group : null;
    }

    /**
     * Get all assembled group names.
     * @returns {string[]}
     */
    getAssembledGroupNames() {
        return Array.from(this.assembledGroups.keys());
    }

    /**
     * Apply a transformation to all meshes in an assembled group.
     * @param {string} groupName
     * @param {Function} fn - Callback (mesh) => void
     */
    forEachAssembledMesh(groupName, fn) {
        const meshes = this.getAssembledGroupMeshes(groupName);
        if (meshes) meshes.forEach(fn);
    }

    /**
     * Set visibility for all meshes in an assembled group.
     * @param {string} groupName
     * @param {boolean} visible
     */
    setAssembledGroupVisibility(groupName, visible) {
        this.forEachAssembledMesh(groupName, mesh => {
            mesh.visible = visible;
        });
    }

    /**
     * Translate all meshes in an assembled group by an offset.
     * @param {string} groupName
     * @param {THREE.Vector3} offset
     */
    translateAssembledGroup(groupName, offset) {
        this.forEachAssembledMesh(groupName, mesh => {
            mesh.position.add(offset);
        });
    }

    /**
     * Scale all meshes in an assembled group.
     * @param {string} groupName
     * @param {THREE.Vector3 | number} scale
     */
    scaleAssembledGroup(groupName, scale) {
        const scaleVec = typeof scale === 'number' ? new THREE.Vector3(scale, scale, scale) : scale;
        this.forEachAssembledMesh(groupName, mesh => {
            mesh.scale.multiply(scaleVec);
        });
    }
}
  