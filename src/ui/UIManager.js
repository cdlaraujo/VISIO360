// src/ui/UIManager.js

/**
 * @class UIManager
 * @description Manages all UI elements, including collaboration and model loading controls.
 */
export class UIManager {
    constructor(logger, eventBus) {
        this.logger = logger;
        this.eventBus = eventBus;
    }

    initialize() {
        this._getUIReferences();
        this._setupEventListeners();
        this.logger.info('UIManager: Initialized with collaboration and URL loading support.');
    }

    _getUIReferences() {
        // This is a helper to avoid repeatedly calling getElementById
        this.ui = {
            // Collaboration
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
            loadingSpinner: document.getElementById('loading'),
            // Model Loading
            loadModelUrlBtn: document.getElementById('load-model-url-btn'),
            modelUrlInput: document.getElementById('model-url-input'),
            fileInput: document.getElementById('model-input'),
            modelInputArea: document.getElementById('model-input-area'),
            modelInfoArea: document.getElementById('model-info-area'),
            modelNameDisplay: document.getElementById('model-name-display'),
            changeModelBtn: document.getElementById('change-model-btn'),
            // Tools
            measureToolBtn: document.getElementById('measure-tool-btn'),
            areaToolBtn: document.getElementById('area-tool-btn'),
            surfaceAreaToolBtn: document.getElementById('surface-area-tool-btn'),
            clearAllBtn: document.getElementById('clear-all-btn'),
            // Display Panels
            instructionsPanel: document.getElementById('instructions-panel'),
            toolInstructions: document.getElementById('tool-instructions'),
            measurementsPanel: document.getElementById('measurements-panel'),
            distanceList: document.getElementById('distance-list'),
            areaList: document.getElementById('area-list'),
            surfaceAreaList: document.getElementById('surface-area-list'),
        };
    }

    _setupEventListeners() {
        // Collaboration Listeners
        this.ui.createRoomBtn.addEventListener('click', () => this._createRoom());
        this.ui.joinRoomBtn.addEventListener('click', () => this._toggleJoinInput());
        this.ui.joinRoomConfirmBtn.addEventListener('click', () => this._joinRoom());
        this.ui.copyRoomBtn.addEventListener('click', () => this._copyRoomURL());

        // Model Loading Listeners
        this.ui.loadModelUrlBtn.addEventListener('click', () => this._loadModelFromUrl());
        this.ui.fileInput.addEventListener('change', (e) => this._handleFileSelect(e));
        this.ui.changeModelBtn.addEventListener('click', () => this._showModelInputArea());

        // Tool Listeners
        this.ui.measureToolBtn.addEventListener('click', () => this.eventBus.emit('tool:activate', { tool: 'measure' }));
        this.ui.areaToolBtn.addEventListener('click', () => this.eventBus.emit('tool:activate', { tool: 'area' }));
        this.ui.surfaceAreaToolBtn.addEventListener('click', () => this.eventBus.emit('tool:activate', { tool: 'surfaceArea' }));
        this.ui.clearAllBtn.addEventListener('click', () => this.eventBus.emit('measurement:clear:all'));
        
        // Listen to events from other modules
        this.eventBus.on('tool:changed', (payload) => this._updateToolButtons(payload.activeTool));
        this.eventBus.on('ui:instructions:update', (payload) => this._updateInstructions(payload.text));
        this.eventBus.on('ui:measurements:update', (payload) => this._updateMeasurementsDisplay(payload));
        this.eventBus.on('model:loaded', (payload) => this._onModelLoaded(payload));
        this.eventBus.on('collaboration:connected', (data) => this._onCollaborationConnected(data));
        this.eventBus.on('collaboration:peer-joined', () => this._updatePeersList());
        this.eventBus.on('collaboration:peer-left', () => this._updatePeersList());
        this.eventBus.on('collaboration:peer-info', (data) => this._onPeerInfo(data));
    }

    // --- Collaboration Methods ---
    _createRoom() {
        if (window.app?.collaborationManager) {
            this.ui.loadingSpinner.style.display = 'block';
            window.app.collaborationManager.userName = this.ui.userNameInput.value.trim() || 'Usuário';
            window.app.collaborationManager.connect()
                .catch(err => this._showNotification(`Erro ao criar sala: ${err.message}`, 'error'))
                .finally(() => this.ui.loadingSpinner.style.display = 'none');
        }
    }

    _joinRoom() {
        const roomId = this.ui.roomIdInput.value.trim().toUpperCase();
        if (!roomId) {
            alert('Por favor, insira o código da sala.');
            return;
        }
        if (window.app?.collaborationManager) {
            this.ui.loadingSpinner.style.display = 'block';
            window.app.collaborationManager.userName = this.ui.userNameInput.value.trim() || 'Usuário';
            window.app.collaborationManager.connect(roomId)
                .catch(err => this._showNotification(`Erro ao entrar na sala: ${err.message}`, 'error'))
                .finally(() => this.ui.loadingSpinner.style.display = 'none');
        }
    }

    _onCollaborationConnected(data) {
        this.ui.roomConnectPanel.style.display = 'none';
        this.ui.roomInfoPanel.style.display = 'block';
        this.ui.statusDot.classList.add('connected');
        this.ui.connectionStatus.textContent = data.isHost ? '🌟 Host da Sala' : '✅ Conectado';
        this.ui.roomCodeDisplay.textContent = data.roomId;
        this._updatePeersList();
        this._showNotification('Conectado à sala de colaboração!', 'success');
    }
    
    _onPeerInfo(data) {
        this._updatePeersList();
        this._showNotification(`${data.info.name} entrou na sala.`, 'info');
    }
    
    _updatePeersList() {
        const cm = window.app?.collaborationManager;
        if (!cm) return;

        this.ui.peerCount.textContent = cm.connections.size + 1;
        this.ui.peersContainer.innerHTML = ''; // Clear list

        // Add self
        const selfEl = document.createElement('div');
        selfEl.className = 'peer-item';
        selfEl.innerHTML = `<div class="peer-color-dot" style="background: ${cm.userColor};"></div> <span>Você (${cm.userName})</span>`;
        this.ui.peersContainer.appendChild(selfEl);

        // Add others
        cm.peerInfo.forEach((info) => {
            const peerEl = document.createElement('div');
            peerEl.className = 'peer-item';
            peerEl.innerHTML = `<div class="peer-color-dot" style="background: ${info.color};"></div> <span>${info.name}</span>`;
            this.ui.peersContainer.appendChild(peerEl);
        });
    }

    _copyRoomURL() {
        const roomURL = window.app?.collaborationManager?.getRoomURL();
        if (roomURL) {
            navigator.clipboard.writeText(roomURL).then(() => {
                this._showNotification('✅ Link de convite copiado!', 'success');
            });
        }
    }
    
    _toggleJoinInput() {
        this.ui.joinRoomInputDiv.style.display = this.ui.joinRoomInputDiv.style.display === 'none' ? 'grid' : 'none';
    }

    // --- Model Loading Methods ---
    _loadModelFromUrl() {
        let modelUrl = this.ui.modelUrlInput.value.trim();

        if (!modelUrl) {
            alert('Por favor, insira uma URL de modelo 3D válida.');
            return;
        }

        // **NEW: AUTOMATIC GOOGLE DRIVE LINK CONVERSION**
        if (modelUrl.includes("drive.google.com")) {
            this.logger.info('UIManager: Google Drive link detected. Attempting to convert to direct download link.');
            try {
                // Extracts the FILE_ID from various Google Drive URL formats
                const fileId = modelUrl.match(/[-\w]{25,}/);
                if (fileId) {
                    const directUrl = `https://drive.google.com/uc?export=download&id=${fileId[0]}`;
                    this.logger.info(`UIManager: Converted URL to: ${directUrl}`);
                    modelUrl = directUrl; // Use the new, direct link
                } else {
                    throw new Error("Could not find File ID in the URL.");
                }
            } catch (error) {
                this.logger.error("UIManager: Failed to convert Google Drive link.", error);
                alert("Não foi possível converter o link do Google Drive. Certifique-se de que é um link de partilha de arquivo válido.");
                return;
            }
        }

        this.ui.loadingSpinner.style.display = 'block';
        this.eventBus.emit('model:load', { url: modelUrl, fileName: modelUrl.split('/').pop() });
    }
    
    _handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.ui.loadingSpinner.style.display = 'block';
            const fileURL = URL.createObjectURL(file);
            this.eventBus.emit('model:load', { url: fileURL, fileName: file.name });
            event.target.value = null; // Reset for same-file selection
        }
    }
    
    _onModelLoaded(payload) {
        this.ui.loadingSpinner.style.display = 'none';
        this.ui.modelInputArea.style.display = 'none';
        this.ui.modelInfoArea.style.display = 'block';
        this.ui.modelNameDisplay.textContent = payload.model.name;
    }
    
    _showModelInputArea() {
        this.ui.modelInputArea.style.display = 'block';
        this.ui.modelInfoArea.style.display = 'none';
    }

    // --- UI Update Methods ---
    _updateToolButtons(activeTool) {
        [this.ui.measureToolBtn, this.ui.areaToolBtn, this.ui.surfaceAreaToolBtn].forEach(btn => {
            btn.classList.remove('active');
        });
        const activeBtn = {
            'measure': this.ui.measureToolBtn,
            'area': this.ui.areaToolBtn,
            'surfaceArea': this.ui.surfaceAreaToolBtn
        }[activeTool];
        if (activeBtn) activeBtn.classList.add('active');
    }

    _updateInstructions(text) {
        this.ui.toolInstructions.textContent = text;
        this.ui.instructionsPanel.classList.toggle('show', !!text);
    }
    
    _updateMeasurementsDisplay(stats) {
        // Implement logic to display measurements in the UI lists
        // This is a placeholder for your existing measurement display logic
    }

    _showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        // Basic styling based on type
        if (type === 'error') notification.style.backgroundColor = '#dc3545';
        if (type === 'info') notification.style.backgroundColor = '#007bff';
        
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}