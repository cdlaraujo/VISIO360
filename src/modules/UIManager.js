// src/modules/UIManager.js
import Logger from '../utils/Logger.js';

export class UIManager {
    constructor({ state, eventBus, container, rendererDomElement }) {
        this.state = state;
        this.eventBus = eventBus;
        this.container = container;
        this.origin = { module: 'UIManager', function: 'constructor' };

        this._queryDOMElements();
        this.container.appendChild(rendererDomElement);
        // O renderer de labels precisa ser adicionado por cima
        this.container.appendChild(this.state.get().renderer.domElement.nextSibling);

        this._bindDOMEvents();
        this._subscribeToAppEvents();

        this.updateStatus('Please load a model to begin.');
        Logger.info(this.origin, 'UIManager initialized and DOM events bound.');
    }

    _queryDOMElements() {
        this.elements = {
            statusBar: document.getElementById('status-bar'),
            loadingOverlay: document.getElementById('loading-overlay'),
            loadingLabel: document.getElementById('loading-label'),
            progressBar: document.getElementById('progress-bar'),
            toolsControls: document.getElementById('tools-controls'),
            fileInput: document.getElementById('file-input'),
            debugDashboard: document.getElementById('debug-dashboard'),
        };
    }

    _bindDOMEvents() {
        this.elements.fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const url = URL.createObjectURL(file);
            this.eventBus.emit('model:load_request', { url, fileName: file.name });
            e.target.value = '';
        });

        this.elements.toolsControls.addEventListener('click', (e) => {
            const button = e.target.closest('.control-button');
            if (button) {
                const currentMode = this.state.get().activeTool;
                const requestedMode = button.dataset.mode;
                // Clicar no botão ativo desativa o modo.
                const newMode = currentMode === requestedMode ? null : requestedMode;
                this.eventBus.emit('tool:mode_changed', { mode: newMode });
            }
        });
    }

    _subscribeToAppEvents() {
        this.eventBus.on('ui:show_loading', () => {
            this.elements.loadingOverlay.style.display = 'flex';
            this.elements.progressBar.style.width = '0%';
            this.elements.loadingLabel.innerText = 'Loading... 0%';
        });

        this.eventBus.on('ui:update_loading', ({ progress }) => {
            this.elements.progressBar.style.width = `${progress}%`;
            this.elements.loadingLabel.innerText = `Loading... ${progress}%`;
        });
        
        this.eventBus.on('model:loaded', ({ fileName }) => {
            this.elements.loadingOverlay.style.display = 'none';
            this.elements.toolsControls.style.display = 'flex';
            this.updateStatus(`Model loaded: ${fileName}.`);
        });
        
        this.eventBus.on('status:update', ({ message }) => this.updateStatus(message));
        
        this.eventBus.on('ui:show_error', ({ message }) => {
            this.elements.loadingOverlay.style.display = 'none';
            alert(message);
            this.updateStatus('Error loading model. Please try another file.');
        });

        this.state.subscribe('activeTool', (toolName) => this._updateToolButtons(toolName));
    }

    updateStatus(message) {
        this.elements.statusBar.innerText = message;
    }

    _updateToolButtons(activeToolName) {
        this.elements.toolsControls.querySelectorAll('.control-button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === activeToolName);
        });
    }
    
    update(delta) {
        // Lógica para dashboard de performance
    }
}
