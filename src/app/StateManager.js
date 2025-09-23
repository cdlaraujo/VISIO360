// src/core/StateManager.js
export default class StateManager {
    constructor(initialState = {}) {
        this.state = { ...initialState };
    }

    /**
     * Obtém o estado atual ou uma propriedade específica.
     * @param {string} [key] - A chave da propriedade a ser obtida. Se omitida, retorna todo o objeto de estado.
     * @returns {*} O estado completo ou o valor da propriedade solicitada.
     */
    get(key) {
        if (key) {
            return this.state[key];
        }
        return this.state;
    }

    /**
     * Define uma ou mais propriedades no estado.
     * @param {object} newState - Um objeto contendo as chaves e valores a serem atualizados.
     */
    set(newState) {
        this.state = { ...this.state, ...newState };
    }
}