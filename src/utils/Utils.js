// src/utils/Utils.js

/**
 * Cria um clone profundo de um objeto simples (JSON-safe).
 * @param {object} obj O objeto a ser clonado.
 * @returns {object} Um clone profundo do objeto.
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    try {
        return JSON.parse(JSON.stringify(obj));
    } catch (e) {
        console.error("Falha no deepClone:", e);
        return {}; 
    }
}

/**
 * Compara dois objetos e retorna um objeto com as chaves que mudaram.
 * @param {object} oldObj O objeto antigo.
 * @param {object} newObj O novo objeto.
 * @returns {object} Um objeto contendo as chaves que mudaram, com 'from' e 'to'.
 */
export function diff(oldObj, newObj) {
    const result = {};
    if (oldObj === newObj) return result;
    if (!oldObj || !newObj || typeof oldObj !== 'object' || typeof newObj !== 'object') {
        return newObj;
    }

    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
    
    allKeys.forEach(key => {
        if (oldObj[key] !== newObj[key]) {
            result[key] = {
                from: oldObj[key],
                to: newObj[key]
            };
        }
    });

    return result;
}
