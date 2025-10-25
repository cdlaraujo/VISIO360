/**
 * @class CollaborationUI
 * @description
 * Um módulo "worker" especializado que lida com toda a lógica de UI relacionada
 * ao painel de colaboração, botões e status.
 * (VERSÃO REFATORADA: Não usa mais 'window.app' e é totalmente orientada a eventos)
 */
export class CollaborationUI {
    /**
     * @param {Logger} logger - O logger da aplicação (injetado).
     * @param {EventBus} eventBus - O barramento de eventos da aplicação (injetado).
     * @param {Object} uiElements - Um objeto contendo APENAS os elementos DOM que este módulo precisa.
     */
    constructor(logger, eventBus, uiElements) {
        this.logger = logger;
        this.eventBus = eventBus;
        this.ui = uiElements; // Recebe apenas os elementos pelos quais se importa

        this.currentRoomURL = null; // Armazena a URL da sala ativa

        this._setupEventListeners();
    }

    /**
     * Configura todos os event listeners que este módulo utiliza.
     * Isso inclui eventos DOM (cliques de botão) e eventos do EventBus.
     * @private
     */
    _setupEventListeners() {
        // --- DOM Event Listeners ---
        this._safeAddEventListener(this.ui.createRoomBtn, 'click', () => this._createRoom());
        this._safeAddEventListener(this.ui.joinRoomBtn, 'click', () => this._showJoinRoomPanel());
        this._safeAddEventListener(this.ui.createRoomBtnPanel, 'click', () => this._createRoom());
        this._safeAddEventListener(this.ui.joinRoomBtnPanel, 'click', () => this._toggleJoinInput());
        this._safeAddEventListener(this.ui.joinRoomConfirmBtn, 'click', () => this._joinRoom());
        this._safeAddEventListener(this.ui.joinRoomCancelBtn, 'click', () => this._toggleJoinInput());
        this._safeAddEventListener(this.ui.disconnectRoomBtn, 'click', () => this._disconnectRoom());
        this._safeAddEventListener(this.ui.roomCodeDisplay, 'click', () => this._copyRoomCode());

        // --- Event Bus Listeners ---
        // Resposta de sucesso ao conectar
        this.eventBus.on('collaboration:connected', d => this._onCollaborationConnected(d));
        
        // Evento que dispara quando a desconexão é concluída
        this.eventBus.on('room:left', () => this._onRoomLeft());
        
        // Solicitações de atualização da lista de peers
        this.eventBus.on('collaboration:peer-joined', () => this._updatePeersList());
        this.eventBus.on('collaboration:peer-left', () => this._updatePeersList());
        this.eventBus.on('collaboration:peer-info', d => this._onPeerInfo(d));
        
        // Resposta do App.js com os dados dos peers para renderizar
        this.eventBus.on('collaboration:peers:update', d => this._renderPeerList(d));

        // Tecla Enter para entrar na sala
        this._safeAddEventListener(this.ui.roomIdInput, 'keypress', (e) => {
            if (e.key === 'Enter') this._joinRoom();
        });

        // Atualiza o nome de usuário quando o foco sai do input
        this._safeAddEventListener(this.ui.userNameInput, 'blur', () => {
            if (this.ui.userNameDisplay) {
                this.ui.userNameDisplay.textContent = this.ui.userNameInput.value || 'Usuário';
            }
        });
    }

    // --- Funções de Ação (Emitir Eventos de Requisição) ---

    _createRoom() {
        const userName = this.ui.userNameInput?.value?.trim() || 'Usuário';
        
        // Emite um evento de "requisição" que o App.js irá ouvir
        this.eventBus.emit('collaboration:create:request', { userName });

        // A UI apenas mostra o progresso. 
        // O App.js será responsável por esconder e mostrar a notificação de sucesso/erro.
        this._showProgressBar('Criando sala...');
    }

    _joinRoom() {
        let roomId = this.ui.roomIdInput?.value?.trim();
        if (!roomId) {
            this._showNotification('Digite o código da sala', 'error');
            return;
        }

        if (roomId.includes('#room=')) {
            const match = roomId.match(/#room=([^&]+)/);
            if (match) {
                roomId = match[1];
            }
        }

        const userName = this.ui.userNameInput?.value?.trim() || 'Usuário';

        // Emite o evento de requisição
        this.eventBus.emit('collaboration:join:request', { userName, roomId });

        this._showProgressBar('Entrando na sala...');
    }

    _disconnectRoom() {
        // Emite o evento de requisição
        this.eventBus.emit('collaboration:disconnect:request');
        // A lógica de UI foi movida para _onRoomLeft()
    }

    _copyRoomCode() {
        const roomURL = this.currentRoomURL; // Usa o valor armazenado localmente
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

    // --- Funções de Resposta (Ouvir Eventos do Barramento) ---

    _onCollaborationConnected(data) {
        this._hideProgressBar(); // Esconde a barra de progresso no sucesso
        this._showNotification(data.isHost ? 'Sala criada com sucesso!' : 'Conectado à sala!', 'success');
        
        this.currentRoomURL = data.roomURL; // Armazena a URL da sala

        // Oculta controles de conexão, mostra status
        this._safeUpdateElement(this.ui.roomConnectControls, el => el.style.display = 'none');
        this._safeUpdateElement(this.ui.roomStatus, el => el.style.display = 'block');
        this._safeUpdateElement(this.ui.peersContainer, el => el.style.display = 'block');
        
        // Atualiza o status da conexão
        this._safeUpdateElement(this.ui.connectionStatus, el => {
            el.textContent = data.isHost ? 'Host' : 'Conectado';
            el.classList.add('connected');
        });

        // Mostra o código da sala
        if (this.ui.roomCodeDisplay && data.roomId) {
            const shortCode = data.roomId.length > 16 
                ? data.roomId.substring(0, 8) + '...' 
                : data.roomId;
            this.ui.roomCodeDisplay.textContent = shortCode;
            this.ui.roomCodeDisplay.title = `Clique para copiar: ${data.roomURL}`; // Mostra URL completa no hover
        }

        this._updatePeersList(); // Solicita a atualização da lista de peers
    }

    /**
     * Lida com a redefinição da UI quando sai de uma sala.
     * @private
     */
    _onRoomLeft() {
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
        
        this.currentRoomURL = null; // Limpa a URL armazenada
        
        this._showNotification('Desconectado da sala', 'info');
        this.logger.info('CollaborationUI: Disconnected from room');
    }

    _onPeerInfo(data) {
        this._updatePeersList(); // Solicita uma nova lista de peers
        this._showNotification(`${data.info.name} entrou na sala`, 'info');
    }

    /**
     * Emite um evento solicitando a lista atual de peers do App.js.
     * @private
     */
    _updatePeersList() {
        // Emite um evento solicitando os dados dos peers
        this.eventBus.emit('collaboration:peers:request');
    }

    /**
     * Recebe os dados dos peers do App.js e renderiza a lista.
     * @param {Object} peerData - Dados de {myProfile, peerProfiles}
     * @private
     */
    _renderPeerList(peerData) {
        if (!peerData || !this.ui.peersContainer) return;

        const { myProfile, peerProfiles } = peerData;

        // Atualiza a contagem de peers
        this._safeUpdateElement(this.ui.peerCount, el => {
            el.textContent = (peerProfiles?.size || 0) + 1; // +1 para si mesmo
        });

        // Limpa e reconstrói a lista de peers
        this.ui.peersContainer.innerHTML = '';

        // Adiciona a si mesmo
        if (myProfile) {
            const selfEl = document.createElement('div');
            selfEl.className = 'peer-item';
            selfEl.innerHTML = `
                <div class="peer-color-dot" style="background: ${myProfile.color};"></div>
                <span class="peer-name">Você (${myProfile.name})</span>
            `;
            this.ui.peersContainer.appendChild(selfEl);
        }

        // Adiciona outros peers
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

    // --- Funções Utilitárias (Emitir para o AppChromeUI) ---
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
        this.eventBus.emit('ui:progress:end'); 
    }
}