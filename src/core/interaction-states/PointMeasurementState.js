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

    onClick(point, intersection, interactionController) {
        // Emite o mesmo evento que as classes de medição (Distance, Angle)
        // já estão ouvindo. Nenhuma modificação nelas é necessária.
        this.eventBus.emit('measurement:point:selected', {
            point: point.clone(),
            tool: this.toolName,
            object: intersection.object,
            face: intersection.face
        });
    }
}