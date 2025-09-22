import { Logger } from '../utils/Logger.js';
import { EventBus } from './EventBus.js';
import { Renderer } from '../modules/Renderer.js';
import { ModelLoader } from '../modules/ModelLoader.js';
import { UIManager } from '../modules/UIManager.js';
import { ToolController } from '../modules/ToolController.js';
import { InteractionController } from '../modules/InteractionController.js'; // Importar o novo módulo

/**
 * @class App
 * @description Classe principal que inicializa todos os sistemas da aplicação.
 */
export class App {
    constructor(container) {
        if (!container) {
            throw new Error('Um elemento container deve ser fornecido para a aplicação.');
        }
        this.container = container;
        
        // --- Sistemas Centrais ---
        this.logger = new Logger('INFO');
        this.eventBus = new EventBus(this.logger);

        // --- Módulos da Aplicação ---
        this.renderer = new Renderer(this.container, this.logger, this.eventBus);
        this.modelLoader = new ModelLoader(this.logger, this.eventBus);
        this.uiManager = new UIManager(this.logger, this.eventBus);
        this.toolController = new ToolController(this.logger, this.eventBus);
        
        // O InteractionController será inicializado após o Renderer
        this.interactionController = null; 
    }

    start() {
        this.logger.info('App: Iniciando a aplicação...');
        
        // O Renderer.initialize() agora retorna a câmera e o elemento DOM
        const rendererComponents = this.renderer.initialize();
        
        this.modelLoader.initialize();
        this.uiManager.initialize();

        // Agora, inicializamos o InteractionController com as dependências do Renderer
        this.interactionController = new InteractionController(
            rendererComponents.camera,
            rendererComponents.domElement,
            this.logger,
            this.eventBus
        );
        
        this._animate();
    }

    _animate() {
        requestAnimationFrame(this._animate.bind(this));
        
        // O evento 'app:update' agora é ouvido pelo Renderer e pelo InteractionController,
        // cada um atualizando seu próprio estado de forma independente.
        this.eventBus.emit('app:update'); 
    }
}