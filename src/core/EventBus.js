/**
 * @class EventBus
 * @description Fornece um sistema de comunicação desacoplado para toda a aplicação.
 * Módulos podem emitir eventos e ouvir eventos sem se conhecerem diretamente.
 */
export class EventBus {
    constructor(logger) {
        this.events = {};
        this.logger = logger;
    }

    /**
     * Registra um ouvinte para um evento específico.
     * @param {string} eventName - O nome do evento a ser ouvido.
     * @param {Function} callback - A função a ser executada quando o evento for emitido.
     */
    on(eventName, callback) {
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }
        this.events[eventName].push(callback);
        this.logger?.debug(`EventBus: Listener registered for event "${eventName}".`);
    }

    /**
     * Emite um evento, acionando todos os seus ouvintes registrados.
     * @param {string} eventName - O nome do evento a ser emitido.
     * @param {*} [payload] - Dados opcionais a serem passados para os ouvintes.
     */
    emit(eventName, payload) {
        this.logger?.debug(`EventBus: Emitting event "${eventName}".`, payload);
        if (this.events[eventName]) {
            this.events[eventName].forEach(callback => {
                try {
                    callback(payload);
                } catch (error) {
                    this.logger?.error(`EventBus: Error in listener for event "${eventName}".`, error);
                }
            });
        }
    }

    /**
     * Remove um ouvinte de um evento.
     * @param {string} eventName - O nome do evento.
     * @param {Function} callbackToRemove - A função de callback específica a ser removida.
     */
    off(eventName, callbackToRemove) {
        if (!this.events[eventName]) {
            return;
        }
        this.events[eventName] = this.events[eventName].filter(
            callback => callback !== callbackToRemove
        );
        this.logger?.debug(`EventBus: Listener removed for event "${eventName}".`);
    }
}
