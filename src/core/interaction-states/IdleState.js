import { BaseInteractionState } from './BaseInteractionState.js';

/**
 * @class IdleState
 * @description O estado padrão "nenhuma ferramenta". Apenas reativa os controles da órbita.
 */
export class IdleState extends BaseInteractionState {
    constructor(eventBus) {
        super('none', eventBus);
    }

    onEnter(interactionController) {
        super.onEnter(interactionController);
        interactionController.setOrbitControlsEnabled(true); // Habilita a órbita
    }

    getCursor() {
        return 'default';
    }

    // Não faz nada em onClick, onMouseMove, etc.
}