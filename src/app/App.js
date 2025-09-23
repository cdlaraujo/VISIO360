// src/app/App.js
import { Logger } from '../utils/Logger.js';
import { EventBus } from './EventBus.js';
import { SceneManager } from '../core/SceneManager.js'; // Importar o novo módulo
import { Renderer } from '../core/Renderer.js';
import { ModelLoader } from '../core/ModelLoader.js';
import { UIManager } from '../ui/UIManager.js';
import { ToolController } from '../ui/ToolController.js';
import { InteractionController } from '../core/InteractionController.js';

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
        this.sceneManager = new SceneManager(this.logger, this.eventBus);
        
        // O Renderer será inicializado após o SceneManager
        this.renderer = null; 
        this.modelLoader = new ModelLoader(this.logger, this.eventBus);
        this.uiManager = new UIManager(this.logger, this.eventBus);
        this.toolController = new ToolController(this.logger, this.eventBus);
        this.interactionController = null; 
    }

    start() {
        this.logger.info('App: Iniciando a aplicação...');
        
        // 1. Inicializa o SceneManager e obtém a cena
        const { scene } = this.sceneManager.initialize();

        // 2. Inicializa o Renderer, passando a cena
        this.renderer = new Renderer(this.container, scene, this.logger, this.eventBus);
        const rendererComponents = this.renderer.initialize();
        
        // 3. Inicializa os outros módulos como antes
        this.modelLoader.initialize();
        this.uiManager.initialize();

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
        this.eventBus.emit('app:update'); 
    }
}