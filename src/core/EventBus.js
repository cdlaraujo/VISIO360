// src/core/EventBus.js
import Logger from '../utils/Logger.js';

export class EventBus {
    constructor() {
        this.listeners = {};
        this.origin = { module: 'EventBus', function: 'constructor' };
        Logger.debug(this.origin, 'EventBus created.');
    }

    /**
     * Assina um evento.
     * @param {string} eventName O nome do evento.
     * @param {function} callback A função a ser chamada quando o evento for emitido.
     * @returns {function} Uma função para cancelar a inscrição.
     */
    on(eventName, callback) {
        if (!this.listeners[eventName]) {
            this.listeners[eventName] = [];
        }
        this.listeners[eventName].push(callback);
        Logger.trace({ ...this.origin, function: 'on' }, `Listener registered for event: '${eventName}'`);

        // Retorna uma função de "unsubscribe" para fácil limpeza
        return () => {
            this.off(eventName, callback);
            Logger.trace({ ...this.origin, function: 'on' }, `Listener for '${eventName}' unregistered via unsubscribe function.`);
        };
    }

    /**
     * Cancela a assinatura de um evento.
     * @param {string} eventName O nome do evento.
     * @param {function} callback A função de callback a ser removida.
     */
    off(eventName, callback) {
        if (!this.listeners[eventName]) return;

        this.listeners[eventName] = this.listeners[eventName].filter(
            listener => listener !== callback
        );
    }

    /**
     * Emite um evento, chamando todos os callbacks assinados.
     * @param {string} eventName O nome do evento a ser emitido.
     * @param {object} [payload={}] Os dados a serem passados para os callbacks.
     */
    emit(eventName, payload = {}) {
        Logger.debug({ ...this.origin, function: 'emit' }, `Event '${eventName}' emitted.`, { payload });
        if (!this.listeners[eventName]) return;

        this.listeners[eventName].forEach(callback => {
            try {
                callback(payload);
            } catch (error) {
                Logger.error({ ...this.origin, function: 'emit' }, `Error in event listener for '${eventName}'`, { error });
            }
        });
    }
}
