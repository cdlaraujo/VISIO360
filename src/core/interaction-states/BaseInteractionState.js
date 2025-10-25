/**
 * @class BaseInteractionState
 * @description Classe base abstrata para todos os estados de interação.
 * Define a interface que o InteractionController espera.
 */
export class BaseInteractionState {
    constructor(toolName, eventBus) {
        this.toolName = toolName;
        this.eventBus = eventBus;
    }

    /** Chamado quando o estado se torna ativo. */
    onEnter(interactionController) {
        interactionController.setCursor(this.getCursor());
        interactionController.setOrbitControlsEnabled(false);
    }

    /** Chamado quando o estado é desativado. */
    onExit(interactionController) {
        interactionController.setCursor('default');
        interactionController.setOrbitControlsEnabled(true);
    }

    /** Lida com um clique na cena. */
    onClick(point, intersection, interactionController) {
        // Implementado por classes filhas
    }

    /** Lida com o movimento do mouse. */
    onMouseMove(point, interactionController) {
        // Implementado por classes filhas
    }

    /** Lida com o pressionamento de tecla. */
    onKeyDown(event, interactionController) {
        // Implementado por classes filhas
    }

    /** Lida com um clique duplo. */
    onDoubleClick(event, interactionController) {
        // Implementado por classes filhas
    }

    /** Retorna o cursor CSS para este estado. */
    getCursor() {
        return 'crosshair';
    }
}