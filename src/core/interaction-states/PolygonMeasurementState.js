import { PointMeasurementState } from './PointMeasurementState.js';

/**
 * @class PolygonMeasurementState
 * @description Um estado para ferramentas de polígono.
 * Adiciona a lógica de 'Esc' e 'DoubleClick' para finalizar a medição.
 */
export class PolygonMeasurementState extends PointMeasurementState {
    constructor(toolName, eventBus) {
        super(toolName, eventBus);
    }

    // O método onClick() é herdado de PointMeasurementState (emite 'measurement:point:selected')

    onKeyDown(event, interactionController) {
        // Replica a lógica que estava no InteractionController
        if (event.key === 'Escape') {
            this.eventBus.emit('measurement:area:finish');
        }
    }

    onDoubleClick(event, interactionController) {
        // Replica a lógica que estava no InteractionController
        this.eventBus.emit('measurement:area:finish');
    }
}