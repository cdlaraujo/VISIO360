// src/core/StateManager.js
import Logger from '../utils/Logger.js';
import { deepClone, diff } from '../utils/Utils.js';

export class StateManager {
    constructor() {
        this.origin = { module: 'StateManager', function: 'constructor' };
        // O estado inicial da aplicação
        this.state = {
            // Core Three.js
            scene: null,
            camera: null,
            renderer: null,
            
            // Modelo e Cena
            targetModel: null,
            pivot: null,
            
            // Interação
            interactionState: 'NONE', // NONE, PENDING, PANNING, ORBITING
            
            // Ferramentas
            activeTool: null, // 'distance', 'area', 'annotate', 'delete'
            allMeasurements: [],
            currentPoints: [],
        };

        this.subscribers = {}; // Armazena callbacks para mudanças em chaves específicas
        Logger.debug(this.origin, 'StateManager initialized.', { initialState: deepClone(this.state) });
    }

    /**
     * Retorna uma cópia do estado atual para prevenir mutações diretas.
     * @returns {object} O estado completo da aplicação.
     */
    get() {
        return { ...this.state };
    }

    /**
     * Atualiza o estado com novas informações e notifica os assinantes.
     * @param {object} updates Um objeto com as chaves do estado a serem atualizadas.
     */
    set(updates) {
        const oldState = { ...this.state };
        
        // Atualiza o estado
        this.state = { ...this.state, ...updates };

        const stateDiff = diff(oldState, this.state);
        if (Object.keys(stateDiff).length > 0) {
            Logger.debug({ ...this.origin, function: 'set' }, 'State updated.', { diff: stateDiff });
            
            // Notifica os assinantes sobre as chaves que mudaram
            Object.keys(stateDiff).forEach(key => {
                if (this.subscribers[key]) {
                    this.subscribers[key].forEach(callback => callback(this.state[key]));
                }
            });
        }
    }

    /**
     * Assina mudanças em uma chave específica do estado.
     * @param {string} key A chave do estado para observar.
     * @param {function} callback A função a ser chamada quando a chave mudar.
     */
    subscribe(key, callback) {
        if (!this.subscribers[key]) {
            this.subscribers[key] = [];
        }
        this.subscribers[key].push(callback);
        Logger.trace({ ...this.origin, function: 'subscribe' }, `New subscriber for state key: '${key}'`);
    }
}
