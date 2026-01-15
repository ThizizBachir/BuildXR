/**
 * ProductSelector - Handles product selection UI at startup
 * Displays cards for user to choose between different products (Drone, Line Follower, etc.)
 */
export class ProductSelector {
    constructor() {
        this.selectedProduct = null;
        this.onSelectCallback = null;
    }

    /**
     * Initialize the product selector
     * @param {Function} onSelect - Callback function when product is selected (receives product name)
     */
    initialize(onSelect) {
        this.onSelectCallback = onSelect;
        
        // Get all product cards
        const productCards = document.querySelectorAll('.product-card');
        
        productCards.forEach(card => {
            card.addEventListener('click', () => {
                const productType = card.getAttribute('data-product');
                this.selectProduct(productType);
            });
        });
        
        console.log('ProductSelector initialized');
    }

    /**
     * Handle product selection
     * @param {string} productType - The selected product type (e.g., 'drone', 'line-follower')
     */
    selectProduct(productType) {
        console.log(`Product selected: ${productType}`);
        this.selectedProduct = productType;
        
        // Hide the selection screen with fade out
        const overlay = document.getElementById('productSelection');
        if (overlay) {
            overlay.classList.add('fade-out');
            
            // Wait for fade animation to complete
            setTimeout(() => {
                overlay.style.display = 'none';
                
                // Show step cards container
                const stepCardsContainer = document.getElementById('stepCardsContainer');
                if (stepCardsContainer) {
                    stepCardsContainer.style.display = 'flex';
                }
                
                // Call the callback with selected product
                if (this.onSelectCallback) {
                    this.onSelectCallback(productType);
                }
            }, 500); // Match CSS animation duration
        }
    }

    /**
     * Get the configuration paths for a specific product
     * @param {string} productType - The product type
     * @returns {Object} Configuration paths
     */
    static getProductConfig(productType) {
        const configs = {
            'drone': {
                modelPath: 'assets/drone.glb',
                meshGroupsPath: 'jsons/ConfigJson/drone/MeshGroups.json',
                assemblyPath: 'jsons/ConfigJson/drone/AssemblyManager.json',
                animationsPath: 'jsons/ConfigJson/drone/AssemblyAnimations.json',
                scale: 2,
                position: [0, 0, 0]
            },
            'line-follower': {
                modelPath: 'assets/line_follower.glb',
                meshGroupsPath: 'jsons/ConfigJson/line-follower/MeshGroups.json',
                assemblyPath: 'jsons/ConfigJson/line-follower/AssemblyManager.json',
                animationsPath: 'jsons/ConfigJson/line-follower/AssemblyAnimations.json',
                scale: 2,
                position: [0, 0, 0]
            }
        };

        return configs[productType] || configs['drone'];
    }
}
