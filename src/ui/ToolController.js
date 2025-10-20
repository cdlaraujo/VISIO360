/**
 * @class ToolController
 * @description Gerencia a ferramenta ativa na aplicação e notifica outros módulos sobre mudanças.
 * Now acts as the gatekeeper (writer) for the 'activeTool' state in StateManager.
 */
export class ToolController {
    // StateManager dependency added
    constructor(logger, eventBus, stateManager) {
        this.logger = logger;
        this.eventBus = eventBus;
        this.stateManager = stateManager; // New dependency

        this._setupEventListeners();
    }

    _setupEventListeners() {
        // Ouve eventos da UI para ativar uma ferramenta
        this.eventBus.on('tool:activate', (payload) => this.setActiveTool(payload.tool));
    }

    /**
     * Define a ferramenta ativa e notifica a aplicação via StateManager.
     * @param {string} toolName - O nome da ferramenta a ser ativada ('none', 'measure', etc.)
     */
    setActiveTool(toolName) {
        const currentTool = this.stateManager.getState('activeTool');

        let newTool;
        if (currentTool === toolName) {
            // Se o usuário clicar na mesma ferramenta, desative-a.
            newTool = 'none';
        } else {
            newTool = toolName;
        }

        // Write the new state, which automatically notifies subscribers.
        this.stateManager.setState('activeTool', newTool);
    }
}
