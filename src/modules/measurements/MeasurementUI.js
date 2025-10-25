// src/modules/measurements/MeasurementUI.js (New Worker File)

export class MeasurementUI {
    constructor(eventBus, manager) {
        this.eventBus = eventBus;
        this.manager = manager; // The main Measurements coordinator

        this._setupEventListeners();
    }

    _setupEventListeners() {
        // Listen for tool changes to update the instruction text.
        this.eventBus.on('tool:changed', (payload) => {
            this._updateInstructions(payload.activeTool);
        });
    }

    /**
     * Updates the instruction panel in the main UI.
     * @param {string} activeTool - The name of the currently active tool.
     * @private
     */
    _updateInstructions(activeTool) {
        const instructions = {
            'none': 'Selecione uma ferramenta para começar.',
            'measure': 'Clique em dois pontos para medir a distância.',
            'area': 'Clique para criar um polígono. Dê um duplo-clique ou pressione ESC para calcular a área.',
            'surfaceArea': 'Clique para criar um polígono. Dê um duplo-clique ou pressione ESC para calcular a área de superfície.',
            'angle': 'Clique em três pontos para medir o ângulo (o primeiro ponto é o vértice).',
            'volume': 'Clique para criar um polígono. Dê um duplo-clique ou pressione ESC para calcular o volume (corte/aterro).' // <-- ADICIONADO
        };
        this.eventBus.emit('ui:instructions:update', { text: instructions[activeTool] || '' });
    }

    /**
     * Fetches the latest measurement stats and tells the main UI to render them.
     */
    update() {
        const stats = this.manager.getMeasurementStats();
        this.eventBus.emit('ui:measurements:update', stats);
    }
}