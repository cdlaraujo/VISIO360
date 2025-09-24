// src/app/App.js
import { Logger } from '../utils/Logger.js';
import { EventBus } from './EventBus.js';
import { SceneManager } from '../core/SceneManager.js';
import { Renderer } from '../core/Renderer.js';
import { ModelLoader } from '../core/ModelLoader.js';
import { UIManager } from '../ui/UIManager.js';
import { ToolController } from '../ui/ToolController.js';
import { InteractionController } from '../core/InteractionController.js';
import { MeasurementManager } from '../modules/MeasurementManager.js';

/**
 * @class App
 * @description Classe principal que inicializa todos os sistemas da aplicação, incluindo as ferramentas de medição.
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
        this.renderer = null;
        this.modelLoader = new ModelLoader(this.logger, this.eventBus);
        this.uiManager = new UIManager(this.logger, this.eventBus);
        this.toolController = new ToolController(this.logger, this.eventBus);
        this.interactionController = null;
        this.measurementManager = null;
    }

    start() {
        this.logger.info('App: Iniciando a aplicação com sistema de medições...');
        
        try {
            // 1. Inicializa o SceneManager e obtém a cena
            const { scene } = this.sceneManager.initialize();

            // 2. Inicializa o Renderer, passando a cena
            this.renderer = new Renderer(this.container, scene, this.logger, this.eventBus);
            const rendererComponents = this.renderer.initialize();
            
            // 3. Inicializa os outros módulos
            this.modelLoader.initialize();
            this.uiManager.initialize();

            // 4. Inicializa o controlador de interação
            this.interactionController = new InteractionController(
                rendererComponents.camera,
                rendererComponents.domElement,
                this.logger,
                this.eventBus
            );

            // 5. Inicializa o sistema de medições
            this.measurementManager = new MeasurementManager(
                scene,
                this.logger,
                this.eventBus
            );

            // 6. Configura listeners adicionais para integração entre módulos
            this._setupCrossModuleIntegration();
            
            // 7. Inicia o loop de animação
            this._animate();

            this.logger.info('App: Aplicação iniciada com sucesso.');
            
        } catch (error) {
            this.logger.error('App: Erro durante a inicialização da aplicação.', error);
            this._handleInitializationError(error);
        }
    }

    /**
     * Configura integrações especiais entre módulos que requerem lógica específica.
     * @private
     */
    _setupCrossModuleIntegration() {
        // Integração entre InteractionController e MeasurementManager
        this.eventBus.on('measurement:point:selected', (payload) => {
            this.logger.debug('App: Ponto selecionado para medição processado.');
        });

        // Integração entre MeasurementManager e outros módulos
        this.eventBus.on('measurement:delete', (payload) => {
            if (this.measurementManager) {
                this.measurementManager.clearMeasurement(payload.id);
            }
        });

        // Listener para limpeza geral de recursos
        this.eventBus.on('app:cleanup', () => {
            this._cleanup();
        });

        // Tratamento de erros globais da aplicação
        this.eventBus.on('app:error', (payload) => {
            this.logger.error('App: Erro global capturado.', payload.error);
        });

        this.logger.info('App: Integrações entre módulos configuradas.');
    }

    /**
     * Loop principal de animação da aplicação.
     * @private
     */
    _animate() {
        try {
            requestAnimationFrame(this._animate.bind(this));
            this.eventBus.emit('app:update');
        } catch (error) {
            this.logger.error('App: Erro no loop de animação.', error);
            this.eventBus.emit('app:error', { error });
        }
    }

    /**
     * Trata erros de inicialização mostrando uma mensagem amigável ao usuário.
     * @param {Error} error - O erro ocorrido durante a inicialização.
     * @private
     */
    _handleInitializationError(error) {
        const errorMessage = `
            <div style="
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                text-align: center;
                color: #ff4444;
                background: rgba(0, 0, 0, 0.8);
                padding: 30px;
                border-radius: 12px;
                border: 1px solid #ff4444;
                font-family: Arial, sans-serif;
            ">
                <h2>Erro na Inicialização</h2>
                <p>Não foi possível inicializar a aplicação.</p>
                <p><strong>Detalhes:</strong> ${error.message}</p>
                <p style="font-size: 0.9em; color: #aaa;">
                    Verifique o console do navegador para mais informações.
                </p>
                <button onclick="location.reload()" style="
                    background: #007bff;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 6px;
                    cursor: pointer;
                    margin-top: 15px;
                ">
                    Recarregar Página
                </button>
            </div>
        `;
        
        this.container.innerHTML = errorMessage;
    }

    /**
     * Limpa recursos da aplicação quando necessário.
     * @private
     */
    _cleanup() {
        this.logger.info('App: Iniciando limpeza de recursos...');
        
        // Limpa medições
        if (this.measurementManager) {
            this.measurementManager.clearAllMeasurements();
        }

        // Remove listeners de eventos do DOM
        if (this.interactionController && this.interactionController.domElement) {
            const element = this.interactionController.domElement;
            element.removeEventListener('click', this.interactionController._onClick);
            element.removeEventListener('wheel', this.interactionController._onMouseWheel);
            element.removeEventListener('mousemove', this.interactionController._onMouseMove);
        }

        // Limpa geometrias e materiais do Three.js se necessário
        // (Esta é uma implementação básica - em produção, seria mais robusta)
        
        this.logger.info('App: Limpeza de recursos concluída.');
    }

    /**
     * API pública para obter referências aos módulos principais (útil para debugging).
     * @returns {object} Objeto contendo referências aos principais módulos.
     */
    getModules() {
        return {
            logger: this.logger,
            eventBus: this.eventBus,
            sceneManager: this.sceneManager,
            renderer: this.renderer,
            modelLoader: this.modelLoader,
            uiManager: this.uiManager,
            toolController: this.toolController,
            interactionController: this.interactionController,
            measurementManager: this.measurementManager
        };
    }

    /**
     * API pública para pausar/retomar a aplicação.
     * @param {boolean} paused - Se true, pausa a aplicação; se false, retoma.
     */
    setPaused(paused) {
        if (paused) {
            this.logger.info('App: Aplicação pausada.');
            // Para o loop de animação não chamando requestAnimationFrame novamente
            this._paused = true;
        } else {
            this.logger.info('App: Aplicação retomada.');
            this._paused = false;
            this._animate(); // Reinicia o loop de animação
        }
    }
}