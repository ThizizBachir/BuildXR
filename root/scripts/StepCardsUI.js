export class StepCardsUI {
    constructor() {
        this.container = document.querySelector('.step-cards-scroll');
        this.activeStepId = null;
        this.onStepSelect = null;
        this.onStepClick = null;
        this.cards = [];
        this.centerIndex = 0;
        this.isScrolling = false;
        this.scrollTimeout = null;
        this.lastScrollTop = 0;
        this.scrollDirection = 0;
    }

    initialize(assemblyConfig, onStepSelectCallback, onStepClickCallback) {
        this.onStepSelect = onStepSelectCallback;
        this.onStepClick = onStepClickCallback;
        this.generateCards(assemblyConfig.steps);
        this.setupScrollListener();
        this.setupWheelListener();
        this.updateCardStates();
    }

    generateCards(steps) {
        if (!this.container) {
            console.warn('StepCardsUI: Container not found');
            return;
        }

        this.container.innerHTML = '';
        this.cards = [];

        // Add padding spacers at top and bottom to allow centering
        const topSpacer = document.createElement('div');
        topSpacer.style.height = 'calc(50% - 80px)';
        this.container.appendChild(topSpacer);

        steps.forEach((step, index) => {
            const card = this.createStepCard(step, index + 1);
            this.container.appendChild(card);
            this.cards.push({ element: card, step, index });
        });

        const bottomSpacer = document.createElement('div');
        bottomSpacer.style.height = 'calc(50% - 80px)';
        this.container.appendChild(bottomSpacer);

        console.log(`StepCardsUI: Generated ${steps.length} step cards`);
        
        // Set initial center card
        setTimeout(() => {
            this.scrollToCard(0, false);
        }, 100);
    }

    createStepCard(step, stepNumber) {
        const card = document.createElement('div');
        card.className = 'step-card';
        card.dataset.stepId = step.id;

        // Count involved items
        const baseMeshCount = step.involved?.baseMeshes?.length || 0;
        const assembledGroupCount = step.involved?.assembledGroups?.length || 0;
        const totalItems = baseMeshCount + assembledGroupCount;

        card.innerHTML = `
            <div class="step-card-header">
                <div class="step-number">${stepNumber}</div>
                <div class="step-label">${step.label || `Step ${stepNumber}`}</div>
            </div>
            <div class="step-card-content">
                <div class="step-meta">
                    <div class="step-meta-item">
                        <span class="step-meta-icon">📦</span>
                        <span>${totalItems} part${totalItems !== 1 ? 's' : ''}</span>
                    </div>
                    ${step.outline?.blinking !== false ? `
                        <div class="step-meta-item">
                            <span class="step-meta-icon">✨</span>
                            <span>Animated</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        // Add click handler
        card.addEventListener('click', () => {
            const cardIndex = this.cards.findIndex(c => c.element === card);
            if (cardIndex !== -1) {
                this.scrollToCard(cardIndex, true);
                // Trigger full step animation (outline + fade + center)
                if (this.onStepClick) {
                    this.onStepClick(step);
                }
            }
        });

        return card;
    }

    setupScrollListener() {
        if (!this.container) return;

        this.container.addEventListener('scroll', () => {
            const currentScrollTop = this.container.scrollTop;
            this.scrollDirection = currentScrollTop > this.lastScrollTop ? 1 : -1;
            this.lastScrollTop = currentScrollTop;
            
            this.isScrolling = true;
            
            clearTimeout(this.scrollTimeout);
            this.scrollTimeout = setTimeout(() => {
                this.isScrolling = false;
                this.snapToNearestCard();
            }, 100);

            this.updateCardStates();
        });
    }

    setupWheelListener() {
        if (!this.container) return;

        this.container.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            if (this.isScrolling) return;
            
            const direction = e.deltaY > 0 ? 1 : -1;
            const nextIndex = this.centerIndex + direction;
            
            if (nextIndex >= 0 && nextIndex < this.cards.length) {
                this.scrollToCard(nextIndex, true);
            }
        }, { passive: false });
    }

    updateCardStates() {
        const containerRect = this.container.getBoundingClientRect();
        const centerY = containerRect.top + containerRect.height / 2;

        let closestCard = 0;
        let closestDistance = Infinity;

        // First pass: find the closest card to center
        this.cards.forEach((cardData, index) => {
            const cardRect = cardData.element.getBoundingClientRect();
            const cardCenterY = cardRect.top + cardRect.height / 2;
            const distance = Math.abs(centerY - cardCenterY);

            if (distance < closestDistance) {
                closestDistance = distance;
                closestCard = index;
            }
        });

        // Check if center card changed
        const centerChanged = this.centerIndex !== closestCard;
        
        // Update center index
        this.centerIndex = closestCard;

        // Second pass: apply classes based on the closest card
        this.cards.forEach((cardData, index) => {
            // Remove all state classes first
            cardData.element.classList.remove('center', 'adjacent', 'edge');

            // Calculate relative position to center
            const relativePosition = Math.abs(index - closestCard);

            if (relativePosition === 0) {
                cardData.element.classList.add('center');
            } else if (relativePosition === 1) {
                cardData.element.classList.add('adjacent');
            } else if (relativePosition >= 2) {
                cardData.element.classList.add('edge');
            }
        });

        // Trigger callback when center card changes
        if (centerChanged && this.onStepSelect && this.cards[closestCard]) {
            this.onStepSelect(this.cards[closestCard].step);
        }
    }

    snapToNearestCard() {
        // Find the card closest to center
        const containerRect = this.container.getBoundingClientRect();
        const centerY = containerRect.top + containerRect.height / 2;

        let closestIndex = 0;
        let closestDistance = Infinity;

        this.cards.forEach((cardData, index) => {
            const cardRect = cardData.element.getBoundingClientRect();
            const cardCenterY = cardRect.top + cardRect.height / 2;
            const distance = Math.abs(centerY - cardCenterY);

            if (distance < closestDistance) {
                closestDistance = distance;
                closestIndex = index;
            }
        });

        this.scrollToCard(closestIndex, true);
    }

    scrollToCard(index, smooth = true) {
        if (index < 0 || index >= this.cards.length) return;

        this.isScrolling = true;
        
        const card = this.cards[index].element;
        const containerRect = this.container.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        
        const containerCenter = containerRect.height / 2;
        const cardCenter = cardRect.height / 2;
        
        const scrollOffset = (cardRect.top - containerRect.top) - containerCenter + cardCenter;
        
        this.container.scrollBy({
            top: scrollOffset,
            behavior: smooth ? 'smooth' : 'auto'
        });

        this.centerIndex = index;
        this.activeStepId = this.cards[index].step.id;
        
        setTimeout(() => {
            this.updateCardStates();
            this.isScrolling = false;
        }, smooth ? 400 : 0);
    }

    selectStep(stepId) {
        const cardIndex = this.cards.findIndex(c => c.step.id === stepId);
        if (cardIndex !== -1) {
            this.scrollToCard(cardIndex, true);
        }
    }

    clearSelection() {
        this.cards.forEach(cardData => {
            cardData.element.classList.remove('center', 'adjacent', 'edge');
        });
        this.activeStepId = null;
    }
}
