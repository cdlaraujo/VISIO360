// src/ui/UIManager.js
export class UIManager {
    constructor(logger, eventBus) {
        this.logger = logger;
        this.eventBus = eventBus;
    }

    initialize() {
        this._getUIReferences();
        this._validateRequiredElements();
        this._setupEventListeners();
    }

    _getUIReferences() {
        this.ui = {
            // Collaboration elements
            createRoomBtn: document.getElementById('create-room-btn'),
            joinRoomBtn: document.getElementById('join-room-btn'),
            joinRoomInputDiv: document.getElementById('join-room-input'),
            joinRoomConfirmBtn: document.getElementById('join-room-confirm-btn'),
            userNameInput: document.getElementById('user-name-input'),
            roomIdInput: document.getElementById('room-id-input'),
            roomConnectPanel: document.getElementById('room-connect-panel'),
            roomInfoPanel: document.getElementById('room-info-panel'),
            statusDot: document.getElementById('status-dot'),
            connectionStatus: document.getElementById('connection-status'),
            roomCodeDisplay: document.getElementById('room-code-display'),
            copyRoomBtn: document.getElementById('copy-room-btn'),
            peerCount: document.getElementById('peer-count'),
            peersContainer: document.getElementById('peers-container'),
            
            // Model loading elements
            loadModelUrlBtn: document.getElementById('load-model-url-btn'),
            modelUrlInput: document.getElementById('model-url-input'),
            fileInput: document.getElementById('model-input'),
            modelInputArea: document.getElementById('model-input-area'),
            modelInfoArea: document.getElementById('model-info-area'),
            modelNameDisplay: document.getElementById('model-name-display'),
            changeModelBtn: document.getElementById('change-model-btn'),
            
            // Measurement tool elements
            measureToolBtn: document.getElementById('measure-tool-btn'),
            areaToolBtn: document.getElementById('area-tool-btn'),
            surfaceAreaToolBtn: document.getElementById('surface-area-tool-btn'),
            clearAllBtn: document.getElementById('clear-all-btn'),
            
            // Instructions and feedback
            instructionsPanel: document.getElementById('instructions-panel'),
            toolInstructions: document.getElementById('tool-instructions'),
            
            // Progress bar
            progressBarContainer: document.getElementById('progress-bar-container'),
            progressBarFill: document.getElementById('progress-bar-fill'),
            progressPercentage: document.getElementById('progress-percentage'),
        };
    }

    /**
     * ✅ FIX #2: Validate that required UI elements exist
     * @throws {Error} If critical elements are missing
     */
    _validateRequiredElements() {
        // Critical elements - app cannot function without these
        const criticalElements = [
            'fileInput',           // File upload is core functionality
            'measureToolBtn',      // Measurement tools are core features
            'areaToolBtn',
            'surfaceAreaToolBtn',
            'clearAllBtn',
        ];

        // Important elements - features will be degraded but app still usable
        const importantElements = [
            'instructionsPanel',
            'toolInstructions',
            'progressBarContainer',
            'progressBarFill',
        ];

        // Optional elements - collaboration features (can work without them)
        const optionalElements = [
            'createRoomBtn',
            'joinRoomBtn',
            'roomConnectPanel',
            'roomInfoPanel',
        ];

        // Check critical elements
        const missingCritical = criticalElements.filter(key => !this.ui[key]);
        if (missingCritical.length > 0) {
            const errorMsg = `UIManager: Missing critical UI elements: ${missingCritical.join(', ')}. The application cannot start.`;
            this.logger.error(errorMsg);
            this._showFatalError(missingCritical);
            throw new Error(errorMsg);
        }

        // Check important elements (warn but don't crash)
        const missingImportant = importantElements.filter(key => !this.ui[key]);
        if (missingImportant.length > 0) {
            this.logger.warn(`UIManager: Missing important UI elements: ${missingImportant.join(', ')}. Some features will be disabled.`);
            this._showWarning(`Some UI elements are missing. Certain features may not work correctly.`);
        }

        // Check optional elements (just log)
        const missingOptional = optionalElements.filter(key => !this.ui[key]);
        if (missingOptional.length > 0) {
            this.logger.info(`UIManager: Missing optional UI elements: ${missingOptional.join(', ')}. Collaboration features will be disabled.`);
        }

        this.logger.info('UIManager: UI element validation completed successfully');
    }

    /**
     * Display a fatal error message to the user when critical elements are missing
     * @param {Array<string>} missingElements - List of missing element IDs
     */
    _showFatalError(missingElements) {
        const appContainer = document.getElementById('app');
        if (appContainer) {
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(220, 53, 69, 0.95);
                color: white;
                padding: 30px;
                border-radius: 12px;
                max-width: 500px;
                text-align: center;
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
            `;
            
            errorDiv.innerHTML = `
                <h2 style="margin: 0 0 15px 0; font-size: 24px;">⚠️ Initialization Error</h2>
                <p style="margin: 0 0 15px 0; font-size: 16px; line-height: 1.5;">
                    The application cannot start because required UI elements are missing from the HTML.
                </p>
                <details style="text-align: left; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 6px; margin-top: 15px;">
                    <summary style="cursor: pointer; font-weight: bold; margin-bottom: 10px;">Missing Elements</summary>
                    <ul style="margin: 0; padding-left: 20px;">
                        ${missingElements.map(el => `<li><code>${el}</code></li>`).join('')}
                    </ul>
                </details>
                <p style="margin: 15px 0 0 0; font-size: 14px; opacity: 0.9;">
                    Please check the browser console for more details.
                </p>
            `;
            
            document.body.appendChild(errorDiv);
        }
    }

    /**
     * Display a warning message for non-critical missing elements
     * @param {string} message - Warning message to display
     */
    _showWarning(message) {
        const warningDiv = document.createElement('div');
        warningDiv.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(255, 193, 7, 0.95);
            color: #333;
            padding: 15px 20px;
            border-radius: 8px;
            max-width: 300px;
            z-index: 9999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            animation: slideIn 0.3s ease-out;
        `;
        
        warningDiv.innerHTML = `
            <strong>⚠️ Warning:</strong><br>${message}
        `;
        
        document.body.appendChild(warningDiv);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            warningDiv.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => warningDiv.remove(), 300);
        }, 5000);
    }

    _setupEventListeners() {
        // Safe event listener setup with null checks
        this._safeAddEventListener(this.ui.createRoomBtn, 'click', () => this._createRoom());
        this._safeAddEventListener(this.ui.joinRoomBtn, 'click', () => this._toggleJoinInput());
        this._safeAddEventListener(this.ui.joinRoomConfirmBtn, 'click', () => this._joinRoom());
        this._safeAddEventListener(this.ui.copyRoomBtn, 'click', () => this._copyRoomURL());
        this._safeAddEventListener(this.ui.loadModelUrlBtn, 'click', () => this._loadModelFromUrl());
        this._safeAddEventListener(this.ui.fileInput, 'change', (e) => this._handleFileSelect(e));
        this._safeAddEventListener(this.ui.changeModelBtn, 'click', () => this._showModelInputArea());
        this._safeAddEventListener(this.ui.measureToolBtn, 'click', () => this.eventBus.emit('tool:activate', { tool: 'measure' }));
        this._safeAddEventListener(this.ui.areaToolBtn, 'click', () => this.eventBus.emit('tool:activate', { tool: 'area' }));
        this._safeAddEventListener(this.ui.surfaceAreaToolBtn, 'click', () => this.eventBus.emit('tool:activate', { tool: 'surfaceArea' }));
        this._safeAddEventListener(this.ui.clearAllBtn, 'click', () => this.eventBus.emit('measurement:clear:all'));
        
        // Event bus listeners (always safe)
        this.eventBus.on('tool:changed', p => this._updateToolButtons(p.activeTool));
        this.eventBus.on('ui:instructions:update', p => this._updateInstructions(p.text));
        this.eventBus.on('model:loading:progress', p => this._updateProgressBar(p.progress));
        this.eventBus.on('model:loaded', p => { this._hideProgressBar(); this._onModelLoaded(p); });
        this.eventBus.on('model:load:error', () => this._hideProgressBar());
        this.eventBus.on('collaboration:connected', d => this._onCollaborationConnected(d));
        this.eventBus.on('collaboration:peer-joined', () => this._updatePeersList());
        this.eventBus.on('collaboration:peer-left', () => this._updatePeersList());
        this.eventBus.on('collaboration:peer-info', d => this._onPeerInfo(d));
        this.eventBus.on('ui:p2p-progress:start', p => this._showProgressBar(`Recebendo de ${p.from}...`));
        this.eventBus.on('ui:p2p-progress:update', p => this._updateProgressBar(p.progress));
        this.eventBus.on('ui:p2p-progress:end', () => { this._hideProgressBar(); this._showNotification('Modelo recebido!', 'success'); });
    }

    /**
     * ✅ FIX #2: Safely add event listener only if element exists
     * @param {HTMLElement|null} element - The DOM element
     * @param {string} event - Event type
     * @param {Function} handler - Event handler
     */
    _safeAddEventListener(element, event, handler) {
        if (element) {
            element.addEventListener(event, handler);
        } else {
            this.logger.debug(`UIManager: Skipping event listener for missing element (${event})`);
        }
    }

    /**
     * ✅ FIX #2: Safely update UI element only if it exists
     * @param {HTMLElement|null} element - The DOM element
     * @param {Function} updateFn - Function to update the element
     */
    _safeUpdateElement(element, updateFn) {
        if (element) {
            try {
                updateFn(element);
            } catch (error) {
                this.logger.error('UIManager: Error updating UI element', error);
            }
        }
    }

    _createRoom() {
        if (!window.app?.collaborationManager) return;
        this._showProgressBar('Conectando...');
        const userName = this.ui.userNameInput?.value?.trim() || 'Usuário';
        window.app.collaborationManager.userName = userName;
        window.app.collaborationManager.connect().finally(() => this._hideProgressBar());
    }

    _joinRoom() {
        let roomId = this.ui.roomIdInput?.value?.trim();
        if (!roomId || !window.app?.collaborationManager) return;
        
        if (roomId.includes('#room=')) {
            const match = roomId.match(/#room=([^&]+)/);
            if (match) {
                roomId = match[1];
                this.logger.info(`UIManager: Extracted peer ID from URL: ${roomId}`);
            }
        }
        
        this._showProgressBar(`Entrando na sala...`);
        const userName = this.ui.userNameInput?.value?.trim() || 'Usuário';
        window.app.collaborationManager.userName = userName;
        window.app.collaborationManager.connect(roomId).finally(() => this._hideProgressBar());
    }

    _onCollaborationConnected(data) {
        this._safeUpdateElement(this.ui.roomConnectPanel, el => el.style.display = 'none');
        this._safeUpdateElement(this.ui.roomInfoPanel, el => el.style.display = 'block');
        this._safeUpdateElement(this.ui.statusDot, el => el.classList.add('connected'));
        this._safeUpdateElement(this.ui.connectionStatus, el => {
            el.textContent = data.isHost ? '🌟 Host da Sala' : '✅ Conectado';
        });
        
        if (this.ui.roomCodeDisplay) {
            const displayCode = data.roomId.length > 20 
                ? data.roomId.substring(0, 8) + '...' + data.roomId.substring(data.roomId.length - 8)
                : data.roomId;
            
            this.ui.roomCodeDisplay.textContent = displayCode;
            this.ui.roomCodeDisplay.title = data.roomId;
            this.ui.roomCodeDisplay.style.fontSize = '0.9em';
            this.ui.roomCodeDisplay.style.wordBreak = 'break-all';
        }
        
        this._updatePeersList();
        this._showNotification('Conectado!', 'success');
    }

    _onPeerInfo(data) {
        this._updatePeersList();
        this._showNotification(`${data.info.name} entrou.`, 'info');
    }

    _updatePeersList() {
        const cm = window.app?.collaborationManager;
        if (!cm || !this.ui.peersContainer) return;
        
        this._safeUpdateElement(this.ui.peerCount, el => {
            el.textContent = cm.connections.size + 1;
        });
        
        this.ui.peersContainer.innerHTML = '';
        const selfEl = document.createElement('div');
        selfEl.className = 'peer-item';
        selfEl.innerHTML = `<div class="peer-color-dot" style="background: ${cm.userColor};"></div> <span>Você (${cm.userName})</span>`;
        this.ui.peersContainer.appendChild(selfEl);
        
        cm.peerInfo.forEach(info => {
            const peerEl = document.createElement('div');
            peerEl.className = 'peer-item';
            peerEl.innerHTML = `<div class="peer-color-dot" style="background: ${info.color};"></div> <span>${info.name}</span>`;
            this.ui.peersContainer.appendChild(peerEl);
        });
    }

    _copyRoomURL() {
        const url = window.app?.collaborationManager?.getRoomURL();
        if (url) {
            navigator.clipboard.writeText(url).then(() => 
                this._showNotification('✅ Link copiado!', 'success')
            ).catch(() => {
                prompt('Copie este link:', url);
            });
        }
    }

    _toggleJoinInput() {
        this._safeUpdateElement(this.ui.joinRoomInputDiv, el => {
            el.style.display = el.style.display === 'none' ? 'grid' : 'none';
        });
    }

    _loadModelFromUrl() {
        let url = this.ui.modelUrlInput?.value?.trim();
        if (!url) return;
        if (url.includes("drive.google.com")) {
            const fileId = url.match(/[-\w]{25,}/);
            if (fileId) url = `https://drive.google.com/uc?export=download&id=${fileId[0]}`;
        }
        this._showProgressBar();
        this.eventBus.emit('model:load', { url, fileName: url.split('/').pop() });
    }

    _handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        this._showProgressBar();
        this.eventBus.emit('model:load', { fileData: file, fileName: file.name });
    }

    _onModelLoaded(payload) {
        this._safeUpdateElement(this.ui.modelInputArea, el => el.style.display = 'none');
        this._safeUpdateElement(this.ui.modelInfoArea, el => el.style.display = 'block');
        this._safeUpdateElement(this.ui.modelNameDisplay, el => el.textContent = payload.model.name);
    }

    _showModelInputArea() {
        this._safeUpdateElement(this.ui.modelInputArea, el => el.style.display = 'block');
        this._safeUpdateElement(this.ui.modelInfoArea, el => el.style.display = 'none');
    }

    _updateToolButtons(tool) {
        Object.values(this.ui).forEach(el => el?.classList?.remove('active'));
        const toolBtn = this.ui[`${tool}ToolBtn`];
        if (toolBtn) toolBtn.classList.add('active');
    }

    _updateInstructions(text) {
        this._safeUpdateElement(this.ui.toolInstructions, el => el.textContent = text);
        this._safeUpdateElement(this.ui.instructionsPanel, el => {
            el.classList.toggle('show', !!text);
        });
    }

    _showProgressBar(message = 'Carregando...') {
        if (!this.ui.progressBarContainer) return;
        
        const textEl = this.ui.progressBarContainer.querySelector('.progress-text');
        if (textEl) {
            textEl.innerHTML = `${message} <span id="progress-percentage">0%</span>`;
            this.ui.progressPercentage = document.getElementById('progress-percentage');
        }
        this.ui.progressBarContainer.style.display = 'block';
        this._updateProgressBar(0);
    }

    _hideProgressBar() {
        this._safeUpdateElement(this.ui.progressBarContainer, el => el.style.display = 'none');
    }

    _updateProgressBar(percent) {
        const p = Math.round(Math.min(100, Math.max(0, percent)));
        this._safeUpdateElement(this.ui.progressBarFill, el => el.style.width = `${p}%`);
        this._safeUpdateElement(this.ui.progressPercentage, el => el.textContent = `${p}%`);
    }

    _showNotification(message, type = 'info') {
        const el = document.createElement('div');
        el.className = 'notification';
        el.textContent = message;
        if (type === 'error') el.style.backgroundColor = '#dc3545';
        if (type === 'success') el.style.backgroundColor = '#28a745';
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 3000);
    }
}