// src/ui/modules/ModelUI.js

/**
 * Manages the UI elements related to loading models and displaying model properties.
 * Handles the model loading modal and the model info section in the left panel.
 */
export class ModelUI {
    constructor(logger, eventBus, uiElements) {
        this.logger = logger;
        this.eventBus = eventBus;
        this.ui = uiElements; // Receives only the elements it needs

        this._setupEventListeners();
    }

    /**
     * Sets up DOM and EventBus listeners relevant to model loading/display.
     * @private
     */
    _setupEventListeners() {
        // --- DOM Event Listeners (Moved from UIManager) ---
        this._safeAddEventListener(this.ui.modelConfigBtn, 'click', () => this._showModelModal());
        this._safeAddEventListener(this.ui.closeModelModal, 'click', () => this._hideModelModal());
        this._safeAddEventListener(this.ui.loadModelUrlBtn, 'click', () => this._loadModelFromUrl());
        this._safeAddEventListener(this.ui.fileInput, 'change', (e) => this._handleFileSelect(e));
        this._safeAddEventListener(this.ui.changeModelBtn, 'click', () => this._showModelInputInModal());

        // Close modal on backdrop click
        this._safeAddEventListener(this.ui.modelLoadingSection, 'click', (e) => {
            if (e.target === this.ui.modelLoadingSection) {
                this._hideModelModal();
            }
        });

        // --- Event Bus Listeners ---
        // Listen for when a model is successfully loaded to update the UI
        this.eventBus.on('model:loaded', p => this._onModelLoaded(p));
    }

    // --- All functions below are MOVED from UIManager.js ---

    _showModelModal() {
        this._safeUpdateElement(this.ui.modelLoadingSection, el => {
            el.style.display = 'flex';
        });
    }

    _hideModelModal() {
        this._safeUpdateElement(this.ui.modelLoadingSection, el => {
            el.style.display = 'none';
        });
    }

    _showModelInputInModal() {
        this._safeUpdateElement(this.ui.modelInputArea, el => el.style.display = 'block');
        this._safeUpdateElement(this.ui.modelInfoArea, el => el.style.display = 'none');
    }

    _loadModelFromUrl() {
        let url = this.ui.modelUrlInput?.value?.trim();
        if (!url) {
            // Emit event for notification instead of calling directly
            this.eventBus.emit('ui:notification:show', { message: 'Digite uma URL válida', type: 'error' });
            return;
        }
        if (url.includes("drive.google.com")) {
            const fileId = url.match(/[-\w]{25,}/);
            if (fileId) {
                url = `https://drive.google.com/uc?export=download&id=${fileId[0]}`;
                this.logger.info('ModelUI: Converted Google Drive URL');
            }
        }
        // Emit events for progress and the load request
        this.eventBus.emit('ui:progress:start', { message: 'Carregando modelo...' });
        this.eventBus.emit('model:load', { url, fileName: url.split('/').pop() || 'model' });
        this._hideModelModal();
    }

    _handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        this.logger.info(`ModelUI: File selected - ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
        
        // Emit events for progress and the load request
        this.eventBus.emit('ui:progress:start', { message: 'Carregando modelo...' });
        this.eventBus.emit('model:load', { fileData: file, fileName: file.name });
        this._hideModelModal();
        
        // Reset file input
        event.target.value = '';
    }

    _onModelLoaded(payload) {
        const displayName = payload.fileName || payload.model?.name || 'Modelo';

        // Update modal info area
        this._safeUpdateElement(this.ui.modelInputArea, el => el.style.display = 'none');
        this._safeUpdateElement(this.ui.modelInfoArea, el => el.style.display = 'block');
        this._safeUpdateElement(this.ui.currentModelName, el => el.textContent = displayName);

        // Update left panel model properties
        this._safeUpdateElement(this.ui.modelNameDisplay, el => {
            el.textContent = displayName;
        });

        this._safeUpdateElement(this.ui.modelFormatDisplay, el => {
            el.textContent = payload.format || '-';
        });

        // Vertex count only available for Three.js meshes; Cesium entities don't support traverse
        let vertexCount = 0;
        if (payload.model && typeof payload.model.traverse === 'function') {
            payload.model.traverse((child) => {
                if (child.isMesh && child.geometry && child.geometry.attributes.position) {
                    vertexCount += child.geometry.attributes.position.count;
                }
            });
        }
        this._safeUpdateElement(this.ui.modelVerticesDisplay, el => {
            el.textContent = vertexCount > 0 ? vertexCount.toLocaleString() : '—';
        });

        this.logger.info(`ModelUI: Updated UI for model - ${displayName}`);
        
        // Emit notification event
        this.eventBus.emit('ui:notification:show', { message: 'Modelo carregado com sucesso!', type: 'success' });
    }

    // --- Helper functions also moved ---
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
                this.logger.error('ModelUI: Error updating UI element', error);
            }
        }
    }
}
