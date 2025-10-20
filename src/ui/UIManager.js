// src/ui/UIManager.js - Fixed and Complete Version for Professional CAD Interface

export class UIManager {
    // StateManager dependency added
    constructor(logger, eventBus, stateManager) {
        this.logger = logger;
        this.eventBus = eventBus;
        this.stateManager = stateManager; // New dependency
        this.ui = {}; // Initialize UI references container
    }

    initialize() {
        this._getUIReferences();
        this._validateRequiredElements();
        this._setupPanelReferences(); // Add this line
        this._setupEventListeners();
        
        // NEW: Subscribe to StateManager immediately after setup
        this.stateManager.subscribe('activeTool', (newTool) => {
            this._updateToolButtons(newTool);
            // Calls _updateInstructions with the active tool name
            this._updateInstructions(newTool); 
        });
    }

    _getUIReferences() {
        this.ui = {
            // Panel containers
            leftPanel: document.querySelector('.left-panel'),
            rightPanel: document.querySelector('.right-panel'),
            
            // Collaboration elements (ribbon + left panel)
            createRoomBtn: document.getElementById('create-room-btn'),
            createRoomBtnPanel: document.getElementById('create-room-btn-panel'),
            joinRoomBtn: document.getElementById('join-room-btn'),
            joinRoomBtnPanel: document.getElementById('join-room-btn-panel'),
            joinRoomInput: document.getElementById('join-room-input'),
            joinRoomConfirmBtn: document.getElementById('join-room-confirm-btn'),
            joinRoomCancelBtn: document.getElementById('join-room-cancel-btn'),
            disconnectRoomBtn: document.getElementById('disconnect-room-btn'),
            userNameInput: document.getElementById('user-name-input'),
            roomIdInput: document.getElementById('room-id-input'),
            roomConnectControls: document.getElementById('room-connect-controls'),
            roomStatus: document.getElementById('room-status'),
            connectionStatus: document.getElementById('connection-status'),
            roomCodeDisplay: document.getElementById('room-code-display'),
            peerCount: document.getElementById('peer-count'),
            peersContainer: document.getElementById('peers-container'),
            userNameDisplay: document.getElementById('user-name-display'),

            // Model loading elements (modal)
            modelConfigBtn: document.getElementById('model-config-btn'),
            modelLoadingSection: document.getElementById('model-loading-section'),
            closeModelModal: document.getElementById('close-model-modal'),
            loadModelUrlBtn: document.getElementById('load-model-url-btn'),
            modelUrlInput: document.getElementById('model-url-input'),
            fileInput: document.getElementById('model-input'),
            modelInputArea: document.getElementById('model-input-area'),
            modelInfoArea: document.getElementById('model-info-area'),
            modelNameDisplay: document.getElementById('model-name-display'),
            currentModelName: document.getElementById('current-model-name'),
            changeModelBtn: document.getElementById('change-model-btn'),
            modelFormatDisplay: document.getElementById('model-format-display'),
            modelVerticesDisplay: document.getElementById('model-vertices-display'),

            // Measurement tool elements (ribbon)
            measureToolBtn: document.getElementById('measure-tool-btn'),
            areaToolBtn: document.getElementById('area-tool-btn'),
            angleToolBtn: document.getElementById('angle-tool-btn'),
            surfaceAreaToolBtn: document.getElementById('surface-area-tool-btn'),
            clearAllBtn: document.getElementById('clear-all-btn'),

            // Measurements panel (right panel)
            measurementsPanel: document.getElementById('measurements-panel'),
            measurementsContainer: document.getElementById('measurements-container'),

            // Instructions and status (status bar)
            toolInstructions: document.getElementById('tool-instructions'),
            coordinates: document.getElementById('coordinates'),
            fpsCounter: document.getElementById('fps-counter'),

            // Progress/Loading
            progressBarContainer: document.querySelector('.progress-bar-container'),
            progressBarFill: document.querySelector('.progress-bar-fill'),
            progressText: document.querySelector('.progress-text'),
        };
    }

    _validateRequiredElements() {
        const criticalElements = [
            'fileInput',
            'measureToolBtn',
            'areaToolBtn',
            'angleToolBtn',
            'surfaceAreaToolBtn',
            'clearAllBtn',
        ];

        const importantElements = [
            'toolInstructions',
            'measurementsContainer',
        ];

        const missingCritical = criticalElements.filter(key => !this.ui[key]);
        if (missingCritical.length > 0) {
            const errorMsg = `UIManager: Missing critical UI elements: ${missingCritical.join(', ')}`;
            this.logger.error(errorMsg);
            this._showFatalError(missingCritical);
            throw new Error(errorMsg);
        }

        const missingImportant = importantElements.filter(key => !this.ui[key]);
        if (missingImportant.length > 0) {
            this.logger.warn(`UIManager: Missing important UI elements: ${missingImportant.join(', ')}`);
        }

        this.logger.info('UIManager: UI element validation completed successfully');
    }

    _setupPanelReferences() {
        // Setup panel references separately after DOM is ready
        this.ui.leftPanel = document.querySelector('.left-panel');
        this.ui.rightPanel = document.querySelector('.right-panel');
        
        if (!this.ui.leftPanel) {
            this.logger.warn('UIManager: Left panel not found');
        }
        if (!this.ui.rightPanel) {
            this.logger.warn('UIManager: Right panel not found');
        }
        
        this.logger.info('UIManager: Panel references configured');
    }

    _showFatalError(missingElements) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: var(--cad-bg-secondary, #252526);
            border: 2px solid var(--cad-error, #f48771);
            color: var(--cad-text-primary, #cccccc);
            padding: 30px;
            border-radius: 8px;
            max-width: 500px;
            text-align: center;
            z-index: 10000;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        `;

        errorDiv.innerHTML = `
            <h2 style="margin: 0 0 15px 0; color: var(--cad-error, #f48771);">⚠️ Initialization Error</h2>
            <p style="margin: 0 0 15px 0;">Required UI elements are missing.</p>
            <details style="text-align: left; background: var(--cad-bg-tertiary, #2d2d30); padding: 10px; border-radius: 6px;">
                <summary style="cursor: pointer; font-weight: bold;">Missing Elements</summary>
                <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                    ${missingElements.map(el => `<li><code>${el}</code></li>`).join('')}
                </ul>
            </details>
        `;

        document.body.appendChild(errorDiv);
    }

    _setupEventListeners() {
        // MODIFICATION: Improved selectors for toggle buttons
        const leftToggle = document.querySelector('.panel-toggle-left');
        const rightToggle = document.querySelector('.panel-toggle-right');
        
        this._safeAddEventListener(leftToggle, 'click', () => this._togglePanel('left'));
        this._safeAddEventListener(rightToggle, 'click', () => this._togglePanel('right'));
        
        // Collaboration events - Ribbon buttons
        this._safeAddEventListener(this.ui.createRoomBtn, 'click', () => this._createRoom());
        this._safeAddEventListener(this.ui.joinRoomBtn, 'click', () => this._showJoinRoomPanel());
        
        // Collaboration events - Panel buttons
        this._safeAddEventListener(this.ui.createRoomBtnPanel, 'click', () => this._createRoom());
        this._safeAddEventListener(this.ui.joinRoomBtnPanel, 'click', () => this._toggleJoinInput());
        this._safeAddEventListener(this.ui.joinRoomConfirmBtn, 'click', () => this._joinRoom());
        this._safeAddEventListener(this.ui.joinRoomCancelBtn, 'click', () => this._toggleJoinInput());
        this._safeAddEventListener(this.ui.disconnectRoomBtn, 'click', () => this._disconnectRoom());
        
        // Click to copy room code
        this._safeAddEventListener(this.ui.roomCodeDisplay, 'click', () => this._copyRoomCode());

        // Model loading events
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

        // Tool buttons
        // Tool buttons now emit 'tool:activate', which ToolController handles by writing to StateManager.
        this._safeAddEventListener(this.ui.measureToolBtn, 'click', () => 
            this.eventBus.emit('tool:activate', { tool: 'measure' }));
        this._safeAddEventListener(this.ui.areaToolBtn, 'click', () => 
            this.eventBus.emit('tool:activate', { tool: 'area' }));
        this._safeAddEventListener(this.ui.angleToolBtn, 'click', () => 
            this.eventBus.emit('tool:activate', { tool: 'angle' }));
        this._safeAddEventListener(this.ui.surfaceAreaToolBtn, 'click', () => 
            this.eventBus.emit('tool:activate', { tool: 'surfaceArea' }));
        this._safeAddEventListener(this.ui.clearAllBtn, 'click', () => {
            this.eventBus.emit('measurement:clear:all');
            this.eventBus.emit('collaboration:clear-all-annotations');
        });

        // Event bus listeners
        // REMOVED: this.eventBus.on('tool:changed', p => this._updateToolButtons(p.activeTool));
        this.eventBus.on('ui:instructions:update', p => this._updateInstructions(p.text)); // Still listens for explicit text updates
        this.eventBus.on('model:loading:progress', p => this._updateProgressBar(p.progress));
        this.eventBus.on('model:loaded', p => { 
            this._hideProgressBar(); 
            this._onModelLoaded(p); 
        });
        this.eventBus.on('model:load:error', (p) => {
            this._hideProgressBar();
            this._showNotification('Erro ao carregar modelo', 'error');
        });
        this.eventBus.on('collaboration:connected', d => this._onCollaborationConnected(d));
        this.eventBus.on('collaboration:peer-joined', () => this._updatePeersList());
        this.eventBus.on('collaboration:peer-left', () => this._updatePeersList());
        this.eventBus.on('collaboration:peer-info', d => this._onPeerInfo(d));
        this.eventBus.on('ui:p2p-progress:start', p => this._showProgressBar(`Recebendo de ${p.from}...`));
        this.eventBus.on('ui:p2p-progress:update', p => this._updateProgressBar(p.progress));
        this.eventBus.on('ui:p2p-progress:end', () => { 
            this._hideProgressBar(); 
            this._showNotification('Modelo recebido!', 'success'); 
        });
        this.eventBus.on('ui:measurements:update', stats => this._updateMeasurementsUI(stats));

        // Update user name display when input changes
        this._safeAddEventListener(this.ui.userNameInput, 'blur', () => {
            if (this.ui.userNameDisplay) {
                this.ui.userNameDisplay.textContent = this.ui.userNameInput.value || 'Usuário';
            }
        });

        // Enter key to join room
        this._safeAddEventListener(this.ui.roomIdInput, 'keypress', (e) => {
            if (e.key === 'Enter') {
                this._joinRoom();
            }
        });

        this.logger.info('UIManager: Event listeners configured successfully');
    }

    _safeAddEventListener(element, event, handler) {
        if (element) {
            element.addEventListener(event, handler);
        } else {
            // This is expected for panel toggles if a panel is missing
        }
    }

    _safeUpdateElement(element, updateFn) {
        if (element) {
            try {
                updateFn(element);
            } catch (error) {
                this.logger.error('UIManager: Error updating UI element', error);
            }
        }
    }

    // ===== PANEL TOGGLE METHODS =====

    _togglePanel(side) {
        if (!side) return;
        
        const panel = side === 'left' ? this.ui.leftPanel : this.ui.rightPanel;
        const layout = document.querySelector('.cad-layout');

        if (!panel || !layout) {
            this.logger.warn(`UIManager: Cannot toggle panel, element missing.`);
            return;
        }
        
        // Toggle class on the panel for its own styles (e.g., hiding content)
        panel.classList.toggle('collapsed');
        
        // Toggle a class on the main layout to trigger viewport resizing
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

    // ===== COLLABORATION METHODS =====

    _createRoom() {
        if (!window.app?.collaboration) {
            this._showNotification('Sistema de colaboração não disponível', 'error');
            this.logger.warn('UIManager: Collaboration system not available');
            return;
        }
        
        const userName = this.ui.userNameInput?.value?.trim() || 'Usuário';
        window.app.collaboration.userName = userName;
        
        this._showProgressBar('Criando sala...');
        window.app.collaboration.connect()
            .then(() => {
                this._hideProgressBar();
                this._showNotification('Sala criada com sucesso!', 'success');
                this.logger.info('UIManager: Room created successfully');
            })
            .catch((error) => {
                this._hideProgressBar();
                this._showNotification('Erro ao criar sala', 'error');
                this.logger.error('UIManager: Error creating room:', error);
            });
    }

    _showJoinRoomPanel() {
        // For ribbon button - show the join input in panel and focus
        this._safeUpdateElement(this.ui.joinRoomInput, el => {
            el.style.display = 'block';
        });
        
        if (this.ui.roomIdInput) {
            setTimeout(() => this.ui.roomIdInput.focus(), 100);
        }
    }

    _toggleJoinInput() {
        // For panel button - toggle the join input visibility
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
            this.logger.warn('UIManager: Collaboration system not available');
            return;
        }

        // Extract room ID from URL if needed
        if (roomId.includes('#room=')) {
            const match = roomId.match(/#room=([^&]+)/);
            if (match) {
                roomId = match[1];
                this.logger.info(`UIManager: Extracted room ID from URL: ${roomId}`);
            }
        }

        const userName = this.ui.userNameInput?.value?.trim() || 'Usuário';
        window.app.collaboration.userName = userName;

        this._showProgressBar('Entrando na sala...');
        window.app.collaboration.connect(roomId)
            .then(() => {
                this._hideProgressBar();
                this._showNotification('Conectado à sala!', 'success');
                this._toggleJoinInput(); // Hide the input after successful join
                
                // Clear the input
                if (this.ui.roomIdInput) {
                    this.ui.roomIdInput.value = '';
                }
                
                this.logger.info('UIManager: Joined room successfully');
            })
            .catch((error) => {
                this._hideProgressBar();
                this._showNotification('Erro ao entrar na sala', 'error');
                this.logger.error('UIManager: Error joining room:', error);
            });
    }

    _disconnectRoom() {
        if (!window.app?.collaboration) return;
        
        window.app.collaboration.disconnect();
        
        // Reset UI to disconnected state
        this._safeUpdateElement(this.ui.roomConnectControls, el => el.style.display = 'none');
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
        this.logger.info('UIManager: Disconnected from room');
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
                this.logger.info('UIManager: Room URL copied to clipboard');
            })
            .catch(() => {
                // Fallback: show prompt
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
        this.logger.info(`UIManager: Connected to collaboration room - ${data.isHost ? 'HOST' : 'GUEST'}`);
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

    // ===== MODEL LOADING METHODS =====

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
            this._showNotification('Digite uma URL válida', 'error');
            return;
        }

        // Handle Google Drive links
        if (url.includes("drive.google.com")) {
            const fileId = url.match(/[-\w]{25,}/);
            if (fileId) {
                url = `https://drive.google.com/uc?export=download&id=${fileId[0]}`;
                this.logger.info('UIManager: Converted Google Drive URL');
            }
        }

        this._showProgressBar('Carregando modelo...');
        this.eventBus.emit('model:load', { url, fileName: url.split('/').pop() });
        this._hideModelModal();
    }

    _handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.logger.info(`UIManager: File selected - ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
        
        this._showProgressBar('Carregando modelo...');
        this.eventBus.emit('model:load', { fileData: file, fileName: file.name });
        this._hideModelModal();
        
        // Reset file input
        event.target.value = '';
    }

    _onModelLoaded(payload) {
        // Update modal info area
        this._safeUpdateElement(this.ui.modelInputArea, el => el.style.display = 'none');
        this._safeUpdateElement(this.ui.modelInfoArea, el => el.style.display = 'block');
        this._safeUpdateElement(this.ui.currentModelName, el => el.textContent = payload.model.name);

        // Update left panel model properties
        this._safeUpdateElement(this.ui.modelNameDisplay, el => {
            el.textContent = payload.model.name;
        });

        // Get and display file extension
        const fileName = payload.model.name || '';
        const extension = fileName.split('.').pop().toUpperCase();
        this._safeUpdateElement(this.ui.modelFormatDisplay, el => {
            el.textContent = extension || '-';
        });

        // Count and display vertices
        let vertexCount = 0;
        if (payload.model) {
            payload.model.traverse((child) => {
                if (child.isMesh && child.geometry && child.geometry.attributes.position) {
                    vertexCount += child.geometry.attributes.position.count;
                }
            });
        }
        this._safeUpdateElement(this.ui.modelVerticesDisplay, el => {
            el.textContent = vertexCount > 0 ? vertexCount.toLocaleString() : '-';
        });

        this._showNotification('Modelo carregado com sucesso!', 'success');
        this.logger.info(`UIManager: Model loaded - ${payload.model.name}, ${vertexCount} vertices`);
    }

    // ===== TOOL METHODS =====

    _updateToolButtons(tool) {
        // Remove active class from all tool buttons
        const toolButtons = [this.ui.measureToolBtn, this.ui.areaToolBtn, this.ui.angleToolBtn, this.ui.surfaceAreaToolBtn];
        toolButtons.forEach(btn => {
            if (btn) btn.classList.remove('active');
        });

        // Add active class to current tool
        const toolMap = {
            'measure': this.ui.measureToolBtn,
            'area': this.ui.areaToolBtn,
            'angle': this.ui.angleToolBtn,
            'surfaceArea': this.ui.surfaceAreaToolBtn
        };

        const activeBtn = toolMap[tool];
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
    }

    // MODIFICATION: Instructions now rely on the active tool name from StateManager
    _updateInstructions(activeTool) {
        const instructions = {
            'none': 'Pronto',
            'measure': 'Clique em dois pontos para medir a distância.',
            'area': 'Clique para criar um polígono. Dê um duplo-clique ou pressione ESC para calcular a área.',
            'surfaceArea': 'Clique para criar um polígono. Dê um duplo-clique ou pressione ESC para calcular a área de superfície.',
            'angle': 'Clique em três pontos para medir o ângulo (o primeiro ponto é o vértice).'
        };
        // Use the instructions map based on the new activeTool value
        this._safeUpdateElement(this.ui.toolInstructions, el => {
            el.textContent = instructions[activeTool] || instructions['none'];
        });
    }

    // ===== MEASUREMENTS UI =====

    _updateMeasurementsUI(stats) {
        if (!this.ui.measurementsContainer) return;

        this.ui.measurementsContainer.innerHTML = '';
        let hasMeasurements = false;

        const createGroup = (title, items, unit) => {
            if (!items || items.length === 0) return;

            hasMeasurements = true;
            const groupDiv = document.createElement('div');
            groupDiv.className = 'measurement-group';

            const titleEl = document.createElement('div');
            titleEl.className = 'measurement-group-title';
            titleEl.textContent = title;
            groupDiv.appendChild(titleEl);

            items.forEach(item => {
                const itemEl = document.createElement('div');
                itemEl.className = 'measurement-item';
                itemEl.innerHTML = `
                    <span class="measurement-value">${item.value.toFixed(2)}${unit}</span>
                    <button class="delete-btn" data-id="${item.id}" title="Remover">×</button>
                `;
                groupDiv.appendChild(itemEl);
            });

            this.ui.measurementsContainer.appendChild(groupDiv);
        };

        createGroup('Distâncias', stats.distances, 'm');
        createGroup('Áreas Planas', stats.areas, 'm²');
        createGroup('Áreas de Superfície', stats.surfaceAreas, 'm²');
        createGroup('Ângulos', stats.angles, '°');

        // Show/hide panel based on whether there are measurements
        this._safeUpdateElement(this.ui.measurementsPanel, el => {
            el.style.display = hasMeasurements ? 'block' : 'none';
        });

        // Add event delegation for delete buttons
        if (hasMeasurements) {
            // Remove old listener if exists
            if (this._measurementClickHandler) {
                this.ui.measurementsContainer.removeEventListener('click', this._measurementClickHandler);
            }
            
            // Add new listener
            this._measurementClickHandler = (event) => {
                if (event.target.classList.contains('delete-btn')) {
                    const id = event.target.dataset.id;
                    if (id) {
                        this.eventBus.emit('measurement:delete', { id });
                    }
                }
            };
            
            this.ui.measurementsContainer.addEventListener('click', this._measurementClickHandler);
        }
    }

    // ===== PROGRESS & NOTIFICATIONS =====

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

    // ===== STATUS BAR UPDATES =====

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
}
