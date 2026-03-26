// Importa os novos estados
import { IdleState } from '../core/interaction-states/IdleState.js';
import { PointMeasurementState } from '../core/interaction-states/PointMeasurementState.js';
import { PolygonMeasurementState } from '../core/interaction-states/PolygonMeasurementState.js';

/**
 * @class ToolController
 * @description Gerencia a ferramenta ativa na aplicação e notifica outros módulos sobre mudanças.
 * (REFATORADO para usar o Padrão State, instanciando estados de interação).
 */
export class ToolController {
    constructor(logger, eventBus, interactionController) { // <-- Recebe o InteractionController
        this.logger = logger;
        this.eventBus = eventBus;
        this.interactionController = interactionController; // <-- Armazena
        
        this.activeToolName = 'none';
        this.activeState = new IdleState(this.eventBus); // Estado inicial
        this.interactionController.setState(this.activeState); // Define o estado inicial

        this._setupEventListeners();
    }

    _setupEventListeners() {
        // Ouve eventos da UI para ativar uma ferramenta
        this.eventBus.on('tool:activate', (payload) => this.setActiveTool(payload.tool));
    }

    /**
     * Define a ferramenta ativa e notifica a aplicação.
     * @param {string} toolName - O nome da ferramenta a ser ativada ('none', 'measure', etc.)
     */
    setActiveTool(toolName) {
        if (this.activeToolName === toolName) {
            // Se o usuário clicar na mesma ferramenta, desative-a.
            toolName = 'none';
        }

        // 1. Sair do estado antigo
        if (this.activeState) {
            this.activeState.onExit(this.interactionController);
        }

        this.activeToolName = toolName;

        // 2. Criar e entrar no novo estado
        switch (toolName) {
            case 'measure':
            case 'angle':
                this.activeState = new PointMeasurementState(toolName, this.eventBus);
                break;
            
            case 'area':
            case 'surfaceArea':
            case 'volume':
                this.activeState = new PolygonMeasurementState(toolName, this.eventBus);
                break;
            
            case 'none':
            default:
                this.activeState = new IdleState(this.eventBus);
                break;
        }

        this.interactionController.setState(this.activeState);
        this.activeState.onEnter(this.interactionController);

        this.logger.info(`ToolController: Active tool changed to "${this.activeToolName}".`);
        
        // Emite um evento para que outros módulos (como a UI) saibam da mudança.
        this.eventBus.emit('tool:changed', { activeTool: this.activeToolName });
    }
}