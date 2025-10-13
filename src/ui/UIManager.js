// src/ui/UIManager.js
/**
 * @class UIManager
 * @description Manages all UI elements including collaboration controls
 */
export class UIManager {
    constructor(logger, eventBus) {
        this.logger = logger;
        this.eventBus = eventBus;

        // UI element references will be set in initialize()
        this.fileInput = null;
        this.measureToolBtn = null;
        this.areaToolBtn = null;
        this.surfaceAreaToolBtn = null;
        this.clearAllBtn = null;
        this.instructionsPanel = null;
        this.measurementsPanel = null;
        
        // Collaboration UI elements
        this.createRoomBtn = null;
        this.joinRoomBtn = null;
        this.joinRoomConfirmBtn = null;
        this.copyRoomBtn = null;
        this.userNameInput = null;
        this.roomIdInput = null;
    }

    initialize() {
        this._getUIReferences();
        this._setupEventListeners();
        this.logger.info('UIManager: Initialized with collaboration support');
    }

    _getUIReferences() {
        // Get references to UI elements (they already exist in HTML)
        this.fileInput = document.getElementById('model-input');
        this.measureToolBtn = document.getElementById('measure-tool-btn');
        this.areaToolBtn = document.getElementById('area-tool-btn');
        this.surfaceAreaToolBtn = document.getElementById('surface-area-tool-btn');
        this.clearAllBtn = document.getElementById('clear-all-btn');
        this.instructionsPanel = document.getElementById('instructions-panel');
        this.measurementsPanel = document.getElementById('measurements-panel');
        
        // Collaboration elements
        this.createRoomBtn = document.getElementById('create-room-btn');
        this.joinRoomBtn = document.getElementById('join-room-btn');
        this.joinRoomConfirmBtn = document.getElementById('join-room-confirm-btn');
        this.copyRoomBtn = document.getElementById('copy-room-btn');
        this.userNameInput = document.getElementById('user-name-input');
        this.roomIdInput = document.getElementById('room-id-input');
    }

    _setupEventListeners() {
        // File input
        if (this.fileInput) {
            this.fileInput.addEventListener('change', this._handleFileSelect.bind(this));
        }

        // Measurement tools
        if (this.measureToolBtn) {
            this.measureToolBtn.addEventListener('click', () => {
                this.eventBus.emit('tool:activate', { tool: 'measure' });
            });
        }

        if (this.areaToolBtn) {
            this.areaToolBtn.addEventListener('click', () => {
                this.eventBus.emit('tool:activate', { tool: 'area' });
            });
        }

        if (this.surfaceAreaToolBtn) {
            this.surfaceAreaToolBtn.addEventListener('click', () => {
                this.eventBus.emit('tool:activate', { tool: 'surfaceArea' });
            });
        }

        if (this.clearAllBtn) {
            this.clearAllBtn.addEventListener('click', () => {
                if (confirm('Limpar todas as medições?')) {
                    this.eventBus.emit('measurement:clear:all');
                }
            });
        }

        // Collaboration controls
        if (this.createRoomBtn) {
            this.createRoomBtn.addEventListener('click', () => {
                const userName = this.userNameInput.value.trim() || 'Usuário';
                this._createRoom(userName);
            });
        }

        if (this.joinRoomBtn) {
            this.joinRoomBtn.addEventListener('click', () => {
                const joinInput = document.getElementById('join-room-input');
                if (joinInput) {
                    joinInput.style.display = joinInput.style.display === 'none' ? 'block' : 'none';
                }
            });
        }

        if (this.joinRoomConfirmBtn) {
            this.joinRoomConfirmBtn.addEventListener('click', () => {
                const userName = this.userNameInput.value.trim() || 'Usuário';
                const roomId = this.roomIdInput.value.trim().toUpperCase();
                if (roomId) {
                    this._joinRoom(userName, roomId);
                } else {
                    alert('Por favor, insira o código da sala');
                }
            });
        }

        if (this.copyRoomBtn) {
            this.copyRoomBtn.addEventListener('click', () => {
                this._copyRoomURL();
            });
        }

        // Event bus listeners
        this.eventBus.on('tool:changed', (payload) => this._updateToolButtons(payload.activeTool));
        this.eventBus.on('ui:instructions:update', (payload) => this._updateInstructions(payload.text));
        this.eventBus.on('ui:measurements:update', (payload) => this._updateMeasurementsDisplay(payload));
        
        // Collaboration event listeners
        this.eventBus.on('collaboration:connected', (data) => this._onCollaborationConnected(data));
        this.eventBus.on('collaboration:peer-joined', (data) => this._onPeerJoined(data));
        this.eventBus.on('collaboration:peer-left', (data) => this._onPeerLeft(data));
        this.eventBus.on('collaboration:peer-info', (data) => this._onPeerInfo(data));
        
        // Measurement completion listeners
        this.eventBus.on('measurement:distance:completed', (payload) => {
            this._showNotification(`Distância medida: ${payload.measurement.distance.toFixed(3)}m`);
        });
        
        this.eventBus.on('measurement:area:completed', (payload) => {
            this._showNotification(`Área medida: ${payload.measurement.area.toFixed(3)}m²`);
        });
        
        this.eventBus.on('measurement:surfaceArea:completed', (payload) => {
            this._showNotification(`Área de superfície: ${payload.measurement.surfaceArea.toFixed(3)}m²`);
        });
    }

    _handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) {
            this.logger.warn('UIManager: No file selected');
            return;
        }

        const fileURL = URL.createObjectURL(file);
        this.logger.info(`UIManager: File selected - ${file.name}`);

        this.eventBus.emit('model:load', { url: fileURL, fileName: file.name });
        event.target.value = null; // Reset input
    }

    _createRoom(userName) {
        if (window.app && window.app.collaborationManager) {
            document.getElementById('loading').style.display = 'block';
            
            window.app.collaborationManager.userName = userName;
            window.app.collaborationManager.connect().then(() => {
                document.getElementById('loading').style.display = 'none';
                this._showNotification('Sala criada com sucesso!');
            }).catch(error => {
                document.getElementById('loading').style.display = 'none';
                this._showNotification('Erro ao criar sala: ' + error.message, 'error');
            });
        }
    }

    _joinRoom(userName, roomId) {
        if (window.app && window.app.collaborationManager) {
            document.getElementById('loading').style.display = 'block';
            
            window.app.collaborationManager.userName = userName;
            window.app.collaborationManager.connect(roomId).then(() => {
                document.getElementById('loading').style.display = 'none';
                this._showNotification('Conectado à sala!');
            }).catch(error => {
                document.getElementById('loading').style.display = 'none';
                this._showNotification('Erro ao entrar na sala: ' + error.message, 'error');
            });
        }
    }

    _onCollaborationConnected(data) {
        // Hide connect panel, show room info
        const connectPanel = document.getElementById('room-connect-panel');
        const infoPanel = document.getElementById('room-info-panel');
        
        if (connectPanel) connectPanel.style.display = 'none';
        if (infoPanel) infoPanel.style.display = 'block';
        
        // Display room code
        const roomCodeDisplay = document.getElementById('room-code-display');
        if (roomCodeDisplay) {
            roomCodeDisplay.textContent = data.roomId;
        }
        
        // Update status
        const statusText = document.getElementById('connection-status');
        if (statusText) {
            statusText.textContent = data.isHost ? '🌟 Host da Sala' : '✅ Conectado';
        }
        
        this._updatePeersList();
        
        this.logger.info('UIManager: Collaboration connected');
    }

    _onPeerJoined(data) {
        this._updatePeersList();
    }

    _onPeerLeft(data) {
        this._updatePeersList();
    }

    _onPeerInfo(data) {
        this._updatePeersList();
        this._showNotification(`${data.info.name} entrou na sala`);
    }

    _updatePeersList() {
        if (window.app && window.app.collaborationManager) {
            const peerCount = window.app.collaborationManager.connections.size + 1;
            const peerCountEl = document.getElementById('peer-count');
            if (peerCountEl) {
                peerCountEl.textContent = peerCount;
            }
            
            // Update peers container
            const container = document.getElementById('peers-container');
            if (container) {
                container.innerHTML = '';
                
                // Add yourself
                const selfItem = document.createElement('div');
                selfItem.className = 'peer-item';
                selfItem.innerHTML = `
                    <div class="peer-color-dot" style="background: ${window.app.collaborationManager.userColor};"></div>
                    <span>Você (${window.app.collaborationManager.userName})</span>
                `;
                container.appendChild(selfItem);
                
                // Add other peers
                window.app.collaborationManager.peerInfo.forEach((info, peerId) => {
                    const peerItem = document.createElement('div');
                    peerItem.className = 'peer-item';
                    peerItem.innerHTML = `
                        <div class="peer-color-dot" style="background: ${info.color};"></div>
                        <span>${info.name}</span>
                    `;
                    container.appendChild(peerItem);
                });
            }
        }
    }

    _copyRoomURL() {
        if (window.app && window.app.collaborationManager) {
            const roomURL = window.app.collaborationManager.getRoomURL();
            
            navigator.clipboard.writeText(roomURL).then(() => {
                this._showNotification('✅ Link copiado! Compartilhe com sua equipe.');
            }).catch(err => {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = roomURL;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                document.body.appendChild(textArea);
                textArea.select();
                try {
                    document.execCommand('copy');
                    this._showNotification('✅ Link copiado!');
                } catch (err) {
                    alert('Link da sala: ' + roomURL);
                }
                document.body.removeChild(textArea);
            });
        }
    }

    _updateToolButtons(activeTool) {
        // Remove active class from all tool buttons
        [this.measureToolBtn, this.areaToolBtn, this.surfaceAreaToolBtn].forEach(btn => {
            if (btn) btn.classList.remove('active');
        });

        // Add active class to selected tool
        if (activeTool === 'measure' && this.measureToolBtn) {
            this.measureToolBtn.classList.add('active');
        } else if (activeTool === 'area' && this.areaToolBtn) {
            this.areaToolBtn.classList.add('active');
        } else if (activeTool === 'surfaceArea' && this.surfaceAreaToolBtn) {
            this.surfaceAreaToolBtn.classList.add('active');
        }
    }

    _updateInstructions(text) {
        const instructionsText = document.getElementById('tool-instructions');
        if (instructionsText) {
            instructionsText.textContent = text;
        }
        
        if (this.instructionsPanel) {
            if (text) {
                this.instructionsPanel.classList.add('show');
            } else {
                this.instructionsPanel.classList.remove('show');
            }
        }
    }

    _updateMeasurementsDisplay(stats) {
        this._updateDistancesList(stats.distances || []);
        this._updateAreasList(stats.areas || []);
        this._updateSurfaceAreasList(stats.surfaceAreas || []);
        
        // Show/hide measurements panel
        const hasResults = (stats.distances && stats.distances.length > 0) || 
                          (stats.areas && stats.areas.length > 0) ||
                          (stats.surfaceAreas && stats.surfaceAreas.length > 0);
        
        if (this.measurementsPanel) {
            this.measurementsPanel.style.display = hasResults ? 'block' : 'none';
        }
    }

    _updateDistancesList(distances) {
        const listEl = document.getElementById('distance-list');
        if (!listEl) return;

        listEl.innerHTML = '';
        
        if (distances.length === 0) {
            listEl.innerHTML = '<div style="text-align: center; color: #888; font-size: 0.85em; padding: 10px;">Nenhuma medição</div>';
            return;
        }
        
        distances.forEach(distance => {
            const item = document.createElement('div');
            item.className = 'measurement-item';
            item.innerHTML = `
                <span class="measurement-value">${distance.value.toFixed(3)}m</span>
                <button class="delete-btn" data-id="${distance.id}">×</button>
            `;
            
            const deleteBtn = item.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', () => {
                this.eventBus.emit('measurement:delete', { id: distance.id });
            });
            
            listEl.appendChild(item);
        });
    }

    _updateAreasList(areas) {
        const listEl = document.getElementById('area-list');
        if (!listEl) return;

        listEl.innerHTML = '';
        
        if (areas.length === 0) {
            listEl.innerHTML = '<div style="text-align: center; color: #888; font-size: 0.85em; padding: 10px;">Nenhuma medição</div>';
            return;
        }
        
        areas.forEach(area => {
            const item = document.createElement('div');
            item.className = 'measurement-item';
            item.innerHTML = `
                <span class="measurement-value">${area.value.toFixed(3)}m²</span>
                <button class="delete-btn" data-id="${area.id}">×</button>
            `;
            
            const deleteBtn = item.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', () => {
                this.eventBus.emit('measurement:delete', { id: area.id });
            });
            
            listEl.appendChild(item);
        });
    }

    _updateSurfaceAreasList(surfaceAreas) {
        const listEl = document.getElementById('surface-area-list');
        if (!listEl) return;

        listEl.innerHTML = '';
        
        if (surfaceAreas.length === 0) {
            listEl.innerHTML = '<div style="text-align: center; color: #888; font-size: 0.85em; padding: 10px;">Nenhuma medição</div>';
            return;
        }
        
        surfaceAreas.forEach(area => {
            const item = document.createElement('div');
            item.className = 'measurement-item';
            item.innerHTML = `
                <span class="measurement-value">${area.value.toFixed(3)}m² (3D)</span>
                <button class="delete-btn" data-id="${area.id}">×</button>
            `;
            
            const deleteBtn = item.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', () => {
                this.eventBus.emit('measurement:delete', { id: area.id });
            });
            
            listEl.appendChild(item);
        });
    }

    _showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.style.background = type === 'error' ? '#dc3545' : '#4CAF50';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}