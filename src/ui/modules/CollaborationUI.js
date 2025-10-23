/**
 * @class CollaborationUI
 * @description
 * A specialized "worker" module that handles all UI logic related to
 * the collaboration panel, buttons, and status.
 * It is instantiated by UIManager and given the elements it needs to control.
 */
export class CollaborationUI {
    /**
     * @param {Logger} logger - The application's logger.
     * @param {EventBus} eventBus - The application's event bus.
     * @param {Object} uiElements - A specific object containing ONLY the DOM elements this module needs.
     */
    constructor(logger, eventBus, uiElements) {
        this.logger = logger;
        this.eventBus = eventBus;
        this.ui = uiElements; // Receives only the elements it cares about

        this._setupEventListeners();
    }

    /**
     * Sets up all event listeners this module cares about.
     * This includes DOM events (button clicks) and EventBus events.
     * @private
     */
    _setupEventListeners() {
        // --- DOM Event Listeners (Moved from UIManager) ---
        this._safeAddEventListener(this.ui.createRoomBtn, 'click', () => this._createRoom());
        this._safeAddEventListener(this.ui.joinRoomBtn, 'click', () => this._showJoinRoomPanel());
        this._safeAddEventListener(this.ui.createRoomBtnPanel, 'click', () => this._createRoom());
        this._safeAddEventListener(this.ui.joinRoomBtnPanel, 'click', () => this._toggleJoinInput());
        this._safeAddEventListener(this.ui.joinRoomConfirmBtn, 'click', () => this._joinRoom());
        this._safeAddEventListener(this.ui.joinRoomCancelBtn, 'click', () => this._toggleJoinInput());
        this._safeAddEventListener(this.ui.disconnectRoomBtn, 'click', () => this._disconnectRoom());
        this._safeAddEventListener(this.ui.roomCodeDisplay, 'click', () => this._copyRoomCode());

        // --- Event Bus Listeners (Moved from UIManager) ---
        this.eventBus.on('collaboration:connected', d => this._onCollaborationConnected(d));
        this.eventBus.on('collaboration:peer-joined', () => this._updatePeersList());
        this.eventBus.on('collaboration:peer-left', () => this._updatePeersList());
        this.eventBus.on('collaboration:peer-info', d => this._onPeerInfo(d));

        // Enter key to join room
        this._safeAddEventListener(this.ui.roomIdInput, 'keypress', (e) => {
            if (e.key === 'Enter') this._joinRoom();
        });

        // Update user name display when input changes
        this._safeAddEventListener(this.ui.userNameInput, 'blur', () => {
            if (this.ui.userNameDisplay) {
                this.ui.userNameDisplay.textContent = this.ui.userNameInput.value || 'Usuário';
            }
        });
    }

    // --- All functions below are MOVED from UIManager.js ---
    // They still contain the `window.app` problem, which we will fix in Phase 2.

    _createRoom() {
        if (!window.app?.collaboration) {
            this._showNotification('Sistema de colaboração não disponível', 'error');
            this.logger.warn('CollaborationUI: Collaboration system not available');
            return;
        }
        
        const userName = this.ui.userNameInput?.value?.trim() || 'Usuário';
        window.app.collaboration.userName = userName;
        
        this._showProgressBar('Criando sala...');
        window.app.collaboration.connect()
            .then(() => {
                this._hideProgressBar();
                this._showNotification('Sala criada com sucesso!', 'success');
                this.logger.info('CollaborationUI: Room created successfully');
            })
            .catch((error) => {
                this._hideProgressBar();
                this._showNotification('Erro ao criar sala', 'error');
                this.logger.error('CollaborationUI: Error creating room:', error);
            });
    }

    _showJoinRoomPanel() {
        this._safeUpdateElement(this.ui.joinRoomInput, el => {
            el.style.display = 'block';
        });
        
        if (this.ui.roomIdInput) {
            setTimeout(() => this.ui.roomIdInput.focus(), 100);
        }
    }

    _toggleJoinInput() {
        this._safeUpdateElement(this.ui.joinRoomInput, el => {
            const isHidden = el.style.display === 'none' || !el.style.display;
            el.style.display = isHidden ? 'block' : 'none';
            
            if (isHidden && this.ui.roomIdInput) {
                setTimeout(() => this.ui.roomIdInput.focus(), 100);
            }
        });
    }

    _joinRoom() {
        let roomId = this.ui.roomIdInput?.value?.trim();
        if (!roomId) {
            this._showNotification('Digite o código da sala', 'error');
            return;
        }
        
        if (!window.app?.collaboration) {
            this._showNotification('Sistema de colaboração não disponível', 'error');
            this.logger.warn('CollaborationUI: Collaboration system not available');
            return;
        }

        if (roomId.includes('#room=')) {
            const match = roomId.match(/#room=([^&]+)/);
            if (match) {
                roomId = match[1];
            }
        }

        const userName = this.ui.userNameInput?.value?.trim() || 'Usuário';
        window.app.collaboration.userName = userName;

        this._showProgressBar('Entrando na sala...');
        window.app.collaboration.connect(roomId)
            .then(() => {
                this._hideProgressBar();
                this._showNotification('Conectado à sala!', 'success');
                this._toggleJoinInput();
                if (this.ui.roomIdInput) this.ui.roomIdInput.value = '';
                this.logger.info('CollaborationUI: Joined room successfully');
            })
            .catch((error) => {
                this._hideProgressBar();
                this._showNotification('Erro ao entrar na sala', 'error');
                this.logger.error('CollaborationUI: Error joining room:', error);
            });
    }

    _disconnectRoom() {
        if (!window.app?.collaboration) return;
        
        window.app.collaboration.disconnect();
        
        this._safeUpdateElement(this.ui.roomConnectControls, el => el.style.display = 'block');
        this._safeUpdateElement(this.ui.roomStatus, el => el.style.display = 'none');
        this._safeUpdateElement(this.ui.joinRoomInput, el => el.style.display = 'none');
        this._safeUpdateElement(this.ui.peersContainer, el => {
            el.style.display = 'none';
            el.innerHTML = '';
        });
        this._safeUpdateElement(this.ui.connectionStatus, el => {
            el.textContent = 'Desconectado';
            el.classList.remove('connected');
        });
        this._safeUpdateElement(this.ui.peerCount, el => {
            el.textContent = '1';
        });
        
        this._showNotification('Desconectado da sala', 'info');
        this.logger.info('CollaborationUI: Disconnected from room');
    }

    _copyRoomCode() {
        const roomURL = window.app?.collaboration?.getRoomURL();
        if (!roomURL) {
            this._showNotification('Nenhuma sala ativa', 'error');
            return;
        }
        
        navigator.clipboard.writeText(roomURL)
            .then(() => {
                this._showNotification('Link copiado!', 'success');
                this.logger.info('CollaborationUI: Room URL copied to clipboard');
            })
            .catch(() => {
                prompt('Copie este link:', roomURL);
            });
    }

    _onCollaborationConnected(data) {
        // Hide connection controls, show status
        this._safeUpdateElement(this.ui.roomConnectControls, el => el.style.display = 'none');
        this._safeUpdateElement(this.ui.roomStatus, el => el.style.display = 'block');
        this._safeUpdateElement(this.ui.peersContainer, el => el.style.display = 'block');
        
        // Update connection status badge
        this._safeUpdateElement(this.ui.connectionStatus, el => {
            el.textContent = data.isHost ? 'Host' : 'Conectado';
            el.classList.add('connected');
        });

        // Display room code (shortened with ellipsis)
        if (this.ui.roomCodeDisplay && data.roomId) {
            const shortCode = data.roomId.length > 16 
                ? data.roomId.substring(0, 8) + '...' 
                : data.roomId;
            this.ui.roomCodeDisplay.textContent = shortCode;
            this.ui.roomCodeDisplay.title = `Clique para copiar: ${data.roomId}`;
        }

        this._updatePeersList();
    }

    _onPeerInfo(data) {
        this._updatePeersList();
        this._showNotification(`${data.info.name} entrou na sala`, 'info');
    }

    _updatePeersList() {
        const collaboration = window.app?.collaboration;
        if (!collaboration || !this.ui.peersContainer) return;

        // Update peer count
        this._safeUpdateElement(this.ui.peerCount, el => {
            const count = collaboration.connectionManager?.getConnectedPeerIds()?.length || 0;
            el.textContent = count + 1; // +1 for self
        });

        // Clear and rebuild peers list
        this.ui.peersContainer.innerHTML = '';

        // Add self
        const myProfile = collaboration.profileManager?.getMyProfile();
        if (myProfile) {
            const selfEl = document.createElement('div');
            selfEl.className = 'peer-item';
            selfEl.innerHTML = `
                <div class="peer-color-dot" style="background: ${myProfile.color};"></div>
                <span class="peer-name">Você (${myProfile.name})</span>
            `;
            this.ui.peersContainer.appendChild(selfEl);
        }

        // Add other peers
        const peerProfiles = collaboration.profileManager?.getAllPeerProfiles();
        if (peerProfiles && peerProfiles.size > 0) {
            peerProfiles.forEach((profile, peerId) => {
                const peerEl = document.createElement('div');
                peerEl.className = 'peer-item';
                peerEl.innerHTML = `
                    <div class="peer-color-dot" style="background: ${profile.color};"></div>
                    <span class="peer-name">${profile.name}</span>
                `;
                this.ui.peersContainer.appendChild(peerEl);
            });
        }
    }

    // --- Helper functions also moved from UIManager ---
    // We refactor these to emit events *up* to the main UIManager
    // which is responsible for global chrome like notifications.

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
                this.logger.error('CollaborationUI: Error updating UI element', error);
            }
        }
    }
    
    _showNotification(message, type = 'info') {
        this.eventBus.emit('ui:notification:show', { message, type });
    }

    _showProgressBar(message = 'Carregando...') {
        this.eventBus.emit('ui:progress:start', { message });
    }

    _hideProgressBar() {
        // We can just emit the 'end' event, UIManager will catch it.
        // Or, more generically, 'model:load:error' also hides it.
        this.eventBus.emit('ui:progress:end'); 
    }
}
