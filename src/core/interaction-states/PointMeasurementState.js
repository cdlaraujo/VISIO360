import { BaseInteractionState } from './BaseInteractionState.js';

/**
 * @class PointMeasurementState
 * @description Um estado para ferramentas que apenas selecionam um número fixo de pontos (ex: Distância, Ângulo).
 * Este estado replica a lógica de clique que estava no InteractionController.
 */
export class PointMeasurementState extends BaseInteractionState {
    constructor(toolName, eventBus) {
        super(toolName, eventBus);
    }

    onClick(point, screenPosition, interactionController) {
        // point is a Cesium.Cartesian3 world position
        this.eventBus.emit('measurement:point:selected', {
            point: point.clone(),
            tool: this.toolName
        });
    }
}