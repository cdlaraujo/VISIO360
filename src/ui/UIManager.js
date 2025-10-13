// src/ui/UIManager.js
export class UIManager {
    constructor(logger, eventBus) {
        this.logger = logger;
        this.eventBus = eventBus;
    }

    initialize() {
        this._getUIReferences();
        this._setupEventListeners();
    }

    _getUIReferences() {
        this.ui = {
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
            loadModelUrlBtn: document.getElementById('load-model-url-btn'),
            modelUrlInput: document.getElementById('model-url-input'),
            fileInput: document.getElementById('model-input'),
            modelInputArea: document.getElementById('model-input-area'),
            modelInfoArea: document.getElementById('model-info-area'),
            modelNameDisplay: document.getElementById('model-name-display'),
            changeModelBtn: document.getElementById('change-model-btn'),
            measureToolBtn: document.getElementById('measure-tool-btn'),
            areaToolBtn: document.getElementById('area-tool-btn'),
            surfaceAreaToolBtn: document.getElementById('surface-area-tool-btn'),
            clearAllBtn: document.getElementById('clear-all-btn'),
            instructionsPanel: document.getElementById('instructions-panel'),
            toolInstructions: document.getElementById('tool-instructions'),
            progressBarContainer: document.getElementById('progress-bar-container'),
            progressBarFill: document.getElementById('progress-bar-fill'),
            progressPercentage: document.getElementById('progress-percentage'),
        };
    }

    _setupEventListeners() {
        this.ui.createRoomBtn.addEventListener('click', () => this._createRoom());
        this.ui.joinRoomBtn.addEventListener('click', () => this._toggleJoinInput());
        this.ui.joinRoomConfirmBtn.addEventListener('click', () => this._joinRoom());
        this.ui.copyRoomBtn.addEventListener('click', () => this._copyRoomURL());
        this.ui.loadModelUrlBtn.addEventListener('click', () => this._loadModelFromUrl());
        this.ui.fileInput.addEventListener('change', (e) => this._handleFileSelect(e));
        this.ui.changeModelBtn.addEventListener('click', () => this._showModelInputArea());
        this.ui.measureToolBtn.addEventListener('click', () => this.eventBus.emit('tool:activate', { tool: 'measure' }));
        this.ui.areaToolBtn.addEventListener('click', () => this.eventBus.emit('tool:activate', { tool: 'area' }));
        this.ui.surfaceAreaToolBtn.addEventListener('click', () => this.eventBus.emit('tool:activate', { tool: 'surfaceArea' }));
        this.ui.clearAllBtn.addEventListener('click', () => this.eventBus.emit('measurement:clear:all'));
        
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

    _createRoom() {
        if (!window.app?.collaborationManager) return;
        this._showProgressBar('Conectando...');
        window.app.collaborationManager.userName = this.ui.userNameInput.value.trim() || 'Usuário';
        window.app.collaborationManager.connect().finally(() => this._hideProgressBar());
    }

    _joinRoom() {
        let roomId = this.ui.roomIdInput.value.trim();
        if (!roomId || !window.app?.collaborationManager) return;
        
        // Parse room ID from URL if user pasted a full link
        if (roomId.includes('#room=')) {
            const match = roomId.match(/#room=([^&]+)/);
            if (match) {
                roomId = match[1];
                this.logger.info(`UIManager: Extracted peer ID from URL: ${roomId}`);
            }
        }
        
        this._showProgressBar(`Entrando na sala...`);
        window.app.collaborationManager.userName = this.ui.userNameInput.value.trim() || 'Usuário';
        window.app.collaborationManager.connect(roomId).finally(() => this._hideProgressBar());
    }

    _onCollaborationConnected(data) {
        this.ui.roomConnectPanel.style.display = 'none';
        this.ui.roomInfoPanel.style.display = 'block';
        this.ui.statusDot.classList.add('connected');
        this.ui.connectionStatus.textContent = data.isHost ? '🌟 Host da Sala' : '✅ Conectado';
        
        // Display full peer ID with copy button (better UX for long IDs)
        const displayCode = data.roomId.length > 20 
            ? data.roomId.substring(0, 8) + '...' + data.roomId.substring(data.roomId.length - 8)
            : data.roomId;
        
        this.ui.roomCodeDisplay.textContent = displayCode;
        this.ui.roomCodeDisplay.title = data.roomId; // Full ID on hover
        this.ui.roomCodeDisplay.style.fontSize = '0.9em'; // Smaller font for long IDs
        this.ui.roomCodeDisplay.style.wordBreak = 'break-all';
        
        this._updatePeersList();
        this._showNotification('Conectado!', 'success');
    }

    _onPeerInfo(data) {
        this._updatePeersList();
        this._showNotification(`${data.info.name} entrou.`, 'info');
    }

    _updatePeersList() {
        const cm = window.app?.collaborationManager;
        if (!cm) return;
        this.ui.peerCount.textContent = cm.connections.size + 1;
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
                // Fallback: show the URL
                prompt('Copie este link:', url);
            });
        }
    }

    _toggleJoinInput() {
        this.ui.joinRoomInputDiv.style.display = this.ui.joinRoomInputDiv.style.display === 'none' ? 'grid' : 'none';
    }

    _loadModelFromUrl() {
        let url = this.ui.modelUrlInput.value.trim();
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
        this.ui.modelInputArea.style.display = 'none';
        this.ui.modelInfoArea.style.display = 'block';
        this.ui.modelNameDisplay.textContent = payload.model.name;
    }

    _showModelInputArea() {
        this.ui.modelInputArea.style.display = 'block';
        this.ui.modelInfoArea.style.display = 'none';
    }

    _updateToolButtons(tool) {
        Object.values(this.ui).forEach(el => el.classList?.remove('active'));
        if (this.ui[`${tool}ToolBtn`]) this.ui[`${tool}ToolBtn`].classList.add('active');
    }

    _updateInstructions(text) {
        this.ui.toolInstructions.textContent = text;
        this.ui.instructionsPanel.classList.toggle('show', !!text);
    }

    _showProgressBar(message = 'Carregando...') {
        const textEl = this.ui.progressBarContainer.querySelector('.progress-text');
        textEl.innerHTML = `${message} <span id="progress-percentage">0%</span>`;
        this.ui.progressPercentage = document.getElementById('progress-percentage');
        this.ui.progressBarContainer.style.display = 'block';
        this._updateProgressBar(0);
    }

    _hideProgressBar() { this.ui.progressBarContainer.style.display = 'none'; }

    _updateProgressBar(percent) {
        const p = Math.round(Math.min(100, Math.max(0, percent)));
        this.ui.progressBarFill.style.width = `${p}%`;
        this.ui.progressPercentage.textContent = `${p}%`;
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