import * as THREE from 'three';

export class MeshGroupLoader {
    constructor() {
        this.baseMeshes = new Map();
        this.assembledGroups = new Map();
        this.meshGroupConfig = null;
    }

    async initialize(configPath) {
        try {
            const res = await fetch(configPath);
            if (!res.ok) {
                throw new Error(`Failed to fetch mesh groups config: ${res.status} ${res.statusText}`);
            }
            this.meshGroupConfig = await res.json();

            if (!this.meshGroupConfig.baseNames) this.meshGroupConfig.baseNames = [];
            if (!this.meshGroupConfig.assembledGroups) this.meshGroupConfig.assembledGroups = [];

            console.log('MeshGroupLoader: Config loaded', this.meshGroupConfig);
        } catch (error) {
            console.error('MeshGroupLoader: Failed to initialize', error);
            throw error;
        }
    }

    buildGroups(rootModel) {
        if (!this.meshGroupConfig) {
            console.warn('MeshGroupLoader: Config not loaded. Call initialize() first.');
            return;
        }

        this.baseMeshes.clear();
        this.assembledGroups.clear();

        this._buildBaseNames(rootModel);
        this._buildAssembledGroups();

        console.log('MeshGroupLoader: Base groups built:', this.getBaseNames());
        console.log('MeshGroupLoader: Assembled groups built:', this.getAssembledGroupNames());
    }

    _buildBaseNames(rootModel) {
        this.meshGroupConfig.baseNames.forEach(baseName => {
            const discovered = this._discoverMeshVariants(rootModel, baseName);
            
            if (discovered.length === 0) {
                console.warn(`MeshGroupLoader: No meshes found for base "${baseName}"`);
                return;
            }
            
            this.baseMeshes.set(baseName, {
                baseName,
                meshes: discovered
            });

            // console.log(`MeshGroupLoader: Created base group "${baseName}" with ${discovered.length} meshes`);
        });
    }

    _buildAssembledGroups() {
        const configByName = new Map();
        this.meshGroupConfig.assembledGroups.forEach(c => {
            if (c && c.name) configByName.set(c.name, c);
        });

        const resolving = new Set();

        const resolveMeshesForName = (name, stack = []) => {
            if (resolving.has(name)) {
                console.warn(`MeshGroupLoader: Circular reference detected: ${[...stack, name].join(' -> ')}`);
                return [];
            }

            const assembledConfig = configByName.get(name);
            if (assembledConfig) {
                resolving.add(name);
                const collected = [];
                const elementsToResolve = assembledConfig.groups || [];
                
                elementsToResolve.forEach(elementName => {
                    const meshes = resolveMeshesForName(elementName, [...stack, name]);
                    if (meshes && meshes.length) {
                        collected.push(...meshes);
                    } else {
                        console.warn(`MeshGroupLoader: Group "${name}" got zero meshes from element "${elementName}"`);
                    }
                });

                resolving.delete(name);
                return collected;
            }

            const baseEntry = this.baseMeshes.get(name);
            if (baseEntry && baseEntry.meshes) {
                return baseEntry.meshes;
            }

            console.warn(`MeshGroupLoader: Element "${name}" not found in assembled groups or baseMeshes`);
            return [];
        };

        this.meshGroupConfig.assembledGroups.forEach(cfg => {
            const name = cfg.name;
            if (!name) {
                console.warn('MeshGroupLoader: Skipping assembled group with missing name', cfg);
                return;
            }

            const collectedMeshes = resolveMeshesForName(name);

            const unique = [];
            const seen = new Set();
            collectedMeshes.forEach(m => {
                if (!seen.has(m.uuid)) {
                    seen.add(m.uuid);
                    unique.push(m);
                }
            });

            this.assembledGroups.set(name, {
                name,
                meshes: unique
            });
            // console.log(`MeshGroupLoader: Created assembled group "${name}" with ${unique.length} meshes`);
        });

        this.assembledGroups.forEach(entry => {
            if (!entry.meshes.length) {
                console.warn(`MeshGroupLoader: Assembled group "${entry.name}" is empty`);
            }
        });
    }

    getAllMeshesForName(name) {
        if (this.baseMeshes.has(name)) {
            return this.getMeshes(name);
        }
        if (this.assembledGroups.has(name)) {
            return this.getAssembledGroupMeshes(name);
        }
        return null;
    }

    _discoverMeshVariants(root, baseName) {
        const found = [];
        const regex = new RegExp(`^${this._escapeRegex(baseName)}(_\\d+)?$`);

        root.traverse(child => {
            if (child.isMesh && regex.test(child.name)) {
                found.push(child);
            }
        });

        found.sort((a, b) => {
            const aMatch = a.name.match(/_(\d+)$/);
            const bMatch = b.name.match(/_(\d+)$/);
            const aNum = aMatch ? parseInt(aMatch[1]) : 0;
            const bNum = bMatch ? parseInt(bMatch[1]) : 0;
            return aNum - bNum;
        });

        return found;
    }

    _escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    getMeshes(baseName) {
        const entry = this.baseMeshes.get(baseName);
        return entry ? entry.meshes : null;
    }

    getBaseNames() {
        return Array.from(this.baseMeshes.keys());
    }

    _forEachMesh(baseName, fn) {
        const meshes = this.getMeshes(baseName);
        if (meshes) meshes.forEach(fn);
    }

    setGroupVisibility(baseName, visible) {
        this._forEachMesh(baseName, mesh => {
            mesh.visible = visible;
        });
    }

    translateGroup(baseName, offset) {
        this._forEachMesh(baseName, mesh => {
            mesh.position.add(offset);
        });
    }

    scaleGroup(baseName, scale) {
        const scaleVec = typeof scale === 'number' ? new THREE.Vector3(scale, scale, scale) : scale;
        this._forEachMesh(baseName, mesh => {
            mesh.scale.multiply(scaleVec);
        });
    }

    getAssembledGroupMeshes(groupName) {
        const entry = this.assembledGroups.get(groupName);
        if (!entry) {
            console.warn(`MeshGroupLoader: assembled group not found`, groupName);
            return null;
        }
        return entry.meshes;
    }

    getAssembledGroupNames() {
        return Array.from(this.assembledGroups.keys());
    }

    _forEachAssembledMesh(groupName, fn) {
        const meshes = this.getAssembledGroupMeshes(groupName);
        if (meshes) meshes.forEach(fn);
    }

    setAssembledGroupVisibility(groupName, visible) {
        this._forEachAssembledMesh(groupName, mesh => {
            mesh.visible = visible;
        });
    }

    translateAssembledGroup(groupName, offset) {
        this._forEachAssembledMesh(groupName, mesh => {
            mesh.position.add(offset);
        });
    }

    scaleAssembledGroup(groupName, scale) {
        const scaleVec = typeof scale === 'number' ? new THREE.Vector3(scale, scale, scale) : scale;
        this._forEachAssembledMesh(groupName, mesh => {
            mesh.scale.multiply(scaleVec);
        });
    }
}
  