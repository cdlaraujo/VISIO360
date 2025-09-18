import { Logger } from '../utils/Logger.js';
import { EventBus } from './EventBus.js';
import { Renderer } from '../modules/Renderer.js';
import { ModelLoader } from '../modules/ModelLoader.js';
import { UIManager } from '../modules/UIManager.js';
import { ToolController } from '../modules/ToolController.js';

/**
 * @class App
 * @description Classe principal que inicializa todos os sistemas centrais da aplicação.
 * Age como um 'inicializador' que orquestra a criação dos módulos,
 * mas a comunicação entre eles é feita via EventBus.
 */
export class App {
    constructor(container) {
        if (!container) {
            throw new Error('Um elemento container deve ser fornecido para a aplicação.');
        }
        this.container = container;
        
        // --- Sistemas Centrais ---
        // O Logger é usado por todos os outros módulos para registrar informações.
        this.logger = new Logger('INFO'); // 'INFO' para um console mais limpo, 'DEBUG' para detalhes completos.
        
        // O EventBus é o "quadro de avisos" que permite a comunicação desacoplada.
        this.eventBus = new EventBus(this.logger);

        // --- Módulos da Aplicação ---
        // Cada módulo recebe as dependências de que precisa, como o logger e o eventBus.
        this.renderer = new Renderer(this.container, this.logger, this.eventBus);
        this.modelLoader = new ModelLoader(this.logger, this.eventBus);
        this.uiManager = new UIManager(this.logger, this.eventBus);
        this.toolController = new ToolController(this.logger, this.eventBus);
    }

    /**
     * Inicia a aplicação, chamando os inicializadores de cada módulo.
     */
    start() {
        this.logger.info('App: Iniciando a aplicação...');
        
        // Inicializa os módulos que precisam de uma configuração inicial.
        this.renderer.initialize();
        this.modelLoader.initialize();
        this.uiManager.initialize();
        // O ToolController não precisa de um método .initialize() porque 
        // seu construtor já registra os listeners de eventos necessários.
        
        // O loop de animação é iniciado.
        this._animate();
    }

    /**
     * O loop de animação principal, executado a cada quadro.
     * Utiliza requestAnimationFrame para otimizar o desempenho e a bateria.
     * @private
     */
    _animate() {
        // Pede ao navegador para chamar esta função novamente no próximo quadro.
        requestAnimationFrame(this._animate.bind(this));
        
        // Emite o evento 'app:update' a cada quadro. O Renderer escuta
        // este evento para saber quando deve redesenhar a cena.
        this.eventBus.emit('app:update'); 
    }
}
