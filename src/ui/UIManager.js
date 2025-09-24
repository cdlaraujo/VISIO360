/**
 * @class UIManager
 * @description Gerencia todos os elementos da interface do usuário, incluindo controles de medição.
 */
export class UIManager {
    constructor(logger, eventBus) {
        this.logger = logger;
        this.eventBus = eventBus;

        // Referências aos elementos da UI
        this.fileInput = null;
        this.measureToolBtn = null;
        this.areaToolBtn = null;
        this.clearAllBtn = null;
        this.instructionsEl = null;
        this.measurementsPanel = null;
    }

    /**
     * Inicializa os elementos da UI e configura os listeners.
     */
    initialize() {
        this._createUIElements();
        this._setupEventListeners();
        this.logger.info('UIManager: Inicializado com interface de medições.');
    }

    _createUIElements() {
        // Cria o container principal da UI se não existir
        let uiContainer = document.getElementById('ui-container');
        if (!uiContainer) {
            uiContainer = document.createElement('div');
            uiContainer.id = 'ui-container';
            document.body.appendChild(uiContainer);
        }

        uiContainer.innerHTML = `
            <h1>Visualizador 3D</h1>
            
            <div class="input-wrapper">
                <label for="model-input" class="custom-file-upload">
                    📁 Carregar Modelo 3D
                </label>
                <input type="file" id="model-input" accept=".ply,.gltf,.glb" />
            </div>

            <div class="tools-section">
                <button id="measure-tool-btn" class="tool-btn">
                    📏 Distância
                </button>
                <button id="area-tool-btn" class="tool-btn">
                    📐 Área
                </button>
                <button id="clear-all-btn" class="tool-btn clear-btn">
                    🗑️ Limpar
                </button>
            </div>

            <div id="instructions-panel" class="instructions-panel">
                <div id="tool-instructions" class="instructions-text"></div>
            </div>

            <div id="measurements-panel" class="measurements-panel">
                <h3>Medições</h3>
                <div id="distance-measurements" class="measurement-group">
                    <h4>Distâncias</h4>
                    <div id="distance-list" class="measurement-list"></div>
                </div>
                <div id="area-measurements" class="measurement-group">
                    <h4>Áreas</h4>
                    <div id="area-list" class="measurement-list"></div>
                </div>
            </div>

            <p class="hint">
                Carregue um modelo 3D e use as ferramentas de medição para analisar suas dimensões.
            </p>
        `;

        // Obtém referências aos elementos criados
        this.fileInput = document.getElementById('model-input');
        this.measureToolBtn = document.getElementById('measure-tool-btn');
        this.areaToolBtn = document.getElementById('area-tool-btn');
        this.clearAllBtn = document.getElementById('clear-all-btn');
        this.instructionsEl = document.getElementById('tool-instructions');
        this.measurementsPanel = document.getElementById('measurements-panel');
    }

    _setupEventListeners() {
        // Listener para seleção de arquivo
        if (this.fileInput) {
            this.fileInput.addEventListener('change', this._handleFileSelect.bind(this));
        }

        // Listeners para ferramentas de medição
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

        if (this.clearAllBtn) {
            this.clearAllBtn.addEventListener('click', () => {
                this.eventBus.emit('measurement:clear:all');
            });
        }

        // Listeners para eventos do sistema
        this.eventBus.on('tool:changed', (payload) => this._updateToolButtons(payload.activeTool));
        this.eventBus.on('ui:instructions:update', (payload) => this._updateInstructions(payload.text));
        this.eventBus.on('ui:measurements:update', (payload) => this._updateMeasurementsDisplay(payload));
        this.eventBus.on('measurement:distance:completed', (payload) => this._onMeasurementCompleted('distance', payload.measurement));
        this.eventBus.on('measurement:area:completed', (payload) => this._onMeasurementCompleted('area', payload.measurement));
    }

    _handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) {
            this.logger.warn('UIManager: Nenhum arquivo selecionado.');
            return;
        }

        const fileURL = URL.createObjectURL(file);
        this.logger.info(`UIManager: Arquivo selecionado - ${file.name}.`);

        this.eventBus.emit('model:load', { url: fileURL, fileName: file.name });
        event.target.value = null;
    }

    _updateToolButtons(activeTool) {
        // Remove classe 'active' de todos os botões
        [this.measureToolBtn, this.areaToolBtn].forEach(btn => {
            if (btn) btn.classList.remove('active');
        });

        // Adiciona classe 'active' ao botão correspondente
        if (activeTool === 'measure' && this.measureToolBtn) {
            this.measureToolBtn.classList.add('active');
        } else if (activeTool === 'area' && this.areaToolBtn) {
            this.areaToolBtn.classList.add('active');
        }
    }

    _updateInstructions(text) {
        if (this.instructionsEl) {
            this.instructionsEl.textContent = text;
            this.instructionsEl.style.display = text ? 'block' : 'none';
        }
    }

    _updateMeasurementsDisplay(stats) {
        this._updateDistancesList(stats.distances || []);
        this._updateAreasList(stats.areas || []);
        
        // Mostra/esconde o painel de medições baseado no conteúdo
        const hasResults = (stats.distances && stats.distances.length > 0) || 
                          (stats.areas && stats.areas.length > 0);
        
        if (this.measurementsPanel) {
            this.measurementsPanel.style.display = hasResults ? 'block' : 'none';
        }
    }

    _updateDistancesList(distances) {
        const listEl = document.getElementById('distance-list');
        if (!listEl) return;

        listEl.innerHTML = '';
        
        distances.forEach((distance, index) => {
            const item = document.createElement('div');
            item.className = 'measurement-item';
            item.innerHTML = `
                <span class="measurement-value">${distance.value.toFixed(3)}m</span>
                <button class="delete-btn" data-id="${distance.id}" data-type="distance">×</button>
            `;
            listEl.appendChild(item);
        });

        // Adiciona listeners para botões de delete
        listEl.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                this.eventBus.emit('measurement:delete', { id });
            });
        });
    }

    _updateAreasList(areas) {
        const listEl = document.getElementById('area-list');
        if (!listEl) return;

        listEl.innerHTML = '';
        
        areas.forEach((area, index) => {
            const item = document.createElement('div');
            item.className = 'measurement-item';
            item.innerHTML = `
                <span class="measurement-value">${area.value.toFixed(3)}m²</span>
                <button class="delete-btn" data-id="${area.id}" data-type="area">×</button>
            `;
            listEl.appendChild(item);
        });

        // Adiciona listeners para botões de delete
        listEl.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                this.eventBus.emit('measurement:delete', { id });
            });
        });
    }

    _onMeasurementCompleted(type, measurement) {
        const message = type === 'distance' 
            ? `Distância medida: ${measurement.distance.toFixed(3)}m`
            : `Área medida: ${measurement.area.toFixed(3)}m²`;
        
        this.logger.info(`UIManager: ${message}`);
        this._showNotification(message);
    }

    _showNotification(message, duration = 3000) {
        // Cria notificação temporária
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 1000;
            font-size: 14px;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // Anima entrada
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        }, 10);
        
        // Remove após duração especificada
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => document.body.removeChild(notification), 300);
        }, duration);
    }
}