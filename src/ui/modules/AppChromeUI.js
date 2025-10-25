// src/ui/modules/AppChromeUI.js

/**
 * Manages the "global chrome" of the application.
 * This includes panel toggling, status bar updates (instructions, FPS),
 * tool button highlighting, notifications, and progress bars.
 */
export class AppChromeUI {
    constructor(logger, eventBus, uiElements) {
        this.logger = logger;
        this.eventBus = eventBus;
        this.ui = uiElements;

        this._setupEventListeners();
    }

    /**
     * Sets up DOM and EventBus listeners for all global UI elements.
     * @private
     */
    _setupEventListeners() {
        // --- DOM Event Listeners ---
        const leftToggle = document.querySelector('.panel-toggle-left');
        const rightToggle = document.querySelector('.panel-toggle-right');
        
        this._safeAddEventListener(leftToggle, 'click', () => this._togglePanel('left'));
        this._safeAddEventListener(rightToggle, 'click', () => this._togglePanel('right'));

        // --- Event Bus Listeners ---
        // Listen for requests from other modules
        this.eventBus.on('ui:notification:show', p => this._showNotification(p.message, p.type));
        this.eventBus.on('ui:progress:start', p => this._showProgressBar(p.message));
        this.eventBus.on('ui:progress:end', () => this._hideProgressBar());

        // Listen for global app state changes
        this.eventBus.on('tool:changed', p => this._updateToolButtons(p.activeTool));
        this.eventBus.on('ui:instructions:update', p => this._updateInstructions(p.text));
        
        // Listen for progress bar events
        this.eventBus.on('model:loading:progress', p => this._updateProgressBar(p.progress));
        this.eventBus.on('model:loaded', p => this._hideProgressBar());
        this.eventBus.on('model:load:error', (p) => {
            this._hideProgressBar();
            this._showNotification('Erro ao carregar modelo', 'error');
        });
        this.eventBus.on('ui:p2p-progress:start', p => this._showProgressBar(`Recebendo de ${p.from}...`));
        this.eventBus.on('ui:p2p-progress:update', p => this._updateProgressBar(p.progress));
        this.eventBus.on('ui:p2p-progress:end', () => { 
            this._hideProgressBar(); 
            this._showNotification('Modelo recebido!', 'success'); 
        });
    }

    // --- All functions below are MOVED from UIManager.js ---

    _togglePanel(side) {
        if (!side) return;
        
        const panel = side === 'left' ? this.ui.leftPanel : this.ui.rightPanel;
        const layout = document.querySelector('.cad-layout');

        if (!panel || !layout) {
            this.logger.warn(`AppChromeUI: Cannot toggle panel, element missing.`);
            return;
        }
        
        panel.classList.toggle('collapsed');
        layout.classList.toggle(`${side}-panel-collapsed`);

        const isCollapsed = panel.classList.contains('collapsed');
        
        // Update the button icon
        const toggleBtn = panel.querySelector(`.panel-toggle-${side}`);
        if (toggleBtn) {
            if (side === 'left') {
                toggleBtn.textContent = isCollapsed ? '▶' : '◀';
            } else {
                toggleBtn.textContent = isCollapsed ? '◀' : '▶';
            }
        }
    }

    _updateToolButtons(tool) {
        // Remove active class from all tool buttons
        const toolButtons = [this.ui.measureToolBtn, this.ui.areaToolBtn, this.ui.angleToolBtn, this.ui.surfaceAreaToolBtn, this.ui.volumeToolBtn, this.ui.volumeBoxToolBtn]; // <-- MODIFICADO
        toolButtons.forEach(btn => {
            if (btn) btn.classList.remove('active');
        });

        // Add active class to current tool
        const toolMap = {
            'measure': this.ui.measureToolBtn,
            'area': this.ui.areaToolBtn,
            'angle': this.ui.angleToolBtn,
            'surfaceArea': this.ui.surfaceAreaToolBtn,
            'volume': this.ui.volumeToolBtn, // <-- ADICIONADO
            'volumeBox': this.ui.volumeBoxToolBtn // <-- NOVO
        };

        const activeBtn = toolMap[tool];
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
    }

    _updateInstructions(text) {
        this._safeUpdateElement(this.ui.toolInstructions, el => {
            el.textContent = text || 'Pronto';
        });
    }

    _showProgressBar(message = 'Carregando...') {
        if (!this.ui.progressBarContainer) {
            // Create progress bar if it doesn't exist
            const container = document.createElement('div');
            container.className = 'progress-bar-container';
            container.style.display = 'block';
            container.innerHTML = `
                <p class="progress-text">${message}</p>
                <div class="progress-bar">
                    <div class="progress-bar-fill"></div>
                </div>
            `;
            document.body.appendChild(container);
            // This is a bit of a hack; ideally, the UIManager would create this
            // and pass it in. But this matches the original logic.
            this.ui.progressBarContainer = container;
            this.ui.progressBarFill = container.querySelector('.progress-bar-fill');
            this.ui.progressText = container.querySelector('.progress-text');
        } else {
            this.ui.progressBarContainer.style.display = 'block';
            if (this.ui.progressText) {
                this.ui.progressText.textContent = message;
            }
        }
        
        this._updateProgressBar(0);
    }

    _hideProgressBar() {
        this._safeUpdateElement(this.ui.progressBarContainer, el => {
            el.style.display = 'none';
        });
    }

    _updateProgressBar(percent) {
        const p = Math.round(Math.min(100, Math.max(0, percent)));
        this._safeUpdateElement(this.ui.progressBarFill, el => {
            el.style.width = `${p}%`;
        });
    }

    _showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.opacity = '1';

        document.body.appendChild(notification);

        // Fade out and remove after 3 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // --- Public Methods for Status Bar ---

    updateCoordinates(x, y, z) {
        this._safeUpdateElement(this.ui.coordinates, el => {
            el.textContent = `X: ${x.toFixed(2)} | Y: ${y.toFixed(2)} | Z: ${z.toFixed(2)}`;
        });
    }

    updateFPS(fps) {
        this._safeUpdateElement(this.ui.fpsCounter, el => {
            el.textContent = `FPS: ${Math.round(fps)}`;
        });
    }

    // --- Helper functions ---
    _safeAddEventListener(element, event, handler) {
        if (element) {
            element.addEventListener(event, handler);
        }
    }

    _safeUpdateElement(element, updateFn) {
        if (element) {
            try {
                updateFn(element);
            } catch (error) {
                this.logger.error('AppChromeUI: Error updating UI element', error);
            }
        }
    }
}