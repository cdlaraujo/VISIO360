// src/modules/UIManager.js
import Logger from '../utils/Logger.js';

export class UIManager {
    constructor({ state, eventBus, container, rendererDomElement }) {
        this.logger = new Logger('UIManager');
        this.state = state;
        this.eventBus = eventBus;
        this.container = container;
        
        // CORREÇÃO: O erro acontecia aqui. Agora, recebemos o elemento pronto.
        if (rendererDomElement) {
            this.container.appendChild(rendererDomElement);
        } else {
            this.logger.error("Renderer DOM element is not valid!");
            return;
        }

        this.setupUI();
        this.logger.info('UIManager initialized.');
    }

    setupUI() {
        // Lógica para criar e gerenciar botões, overlays, etc.
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.fileInput = document.getElementById('file-input');
        
        this.fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                this.eventBus.publish('modelLoadRequested', { file });
            }
        });
    }

    update(delta) {
        // Atualizações da UI a cada frame (ex: FPS counter)
    }
}