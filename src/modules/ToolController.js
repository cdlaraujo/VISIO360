/**
 * @class ToolController
 * @description Gerencia a ferramenta ativa na aplicação e notifica outros módulos sobre mudanças.
 */
export class ToolController {
    constructor(logger, eventBus) {
        this.logger = logger;
        this.eventBus = eventBus;
        this.activeTool = 'none'; // Nenhuma ferramenta ativa por padrão

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
        if (this.activeTool === toolName) {
            // Se o usuário clicar na mesma ferramenta, desative-a.
            this.activeTool = 'none';
        } else {
            this.activeTool = toolName;
        }

        this.logger.info(`ToolController: Active tool changed to "${this.activeTool}".`);
        
        // Emite um evento para que outros módulos (como o InteractionController) saibam da mudança.
        this.eventBus.emit('tool:changed', { activeTool: this.activeTool });
    }
}
