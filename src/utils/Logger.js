// src/utils/Logger.js
// Níveis de log para controle de verbosidade
const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
    TRACE: 4,
};

// Configuração padrão do logger
const config = {
    level: LOG_LEVELS.INFO, // Nível padrão
    sessionID: `session_${Date.now()}`,
};

const Logger = {
    LEVELS: LOG_LEVELS,

    /**
     * Configura o logger com novas definições.
     * @param {object} newConfig Objeto de configuração, ex: { level: LOG_LEVELS.DEBUG }
     */
    configure: (newConfig) => {
        if (newConfig.level !== undefined && LOG_LEVELS[Object.keys(LOG_LEVELS)[newConfig.level]]) {
            config.level = newConfig.level;
        }
        console.log(`[Logger] Configured. Level: ${Object.keys(LOG_LEVELS)[config.level]}`);
    },

    _log: (level, origin, message, data = {}) => {
        if (level > config.level) return;

        const timestamp = new Date().toISOString();
        const levelName = Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === level);

        const consoleMessage = `${timestamp} [${levelName}] (${origin.module}:${origin.function}) - ${message}`;
        const dataIsEmpty = Object.keys(data).length === 0;

        switch (level) {
            case LOG_LEVELS.ERROR:
                dataIsEmpty ? console.error(consoleMessage) : console.error(consoleMessage, data);
                break;
            case LOG_LEVELS.WARN:
                dataIsEmpty ? console.warn(consoleMessage) : console.warn(consoleMessage, data);
                break;
            case LOG_LEVELS.INFO:
                dataIsEmpty ? console.info(consoleMessage) : console.info(consoleMessage, data);
                break;
            default:
                dataIsEmpty ? console.log(consoleMessage) : console.log(consoleMessage, data);
                break;
        }
    },

    // Funções de conveniência para cada nível de log
    error: (origin, message, data) => Logger._log(LOG_LEVELS.ERROR, origin, message, data),
    warn: (origin, message, data) => Logger._log(LOG_LEVELS.WARN, origin, message, data),
    info: (origin, message, data) => Logger._log(LOG_LEVELS.INFO, origin, message, data),
    debug: (origin, message, data) => Logger._log(LOG_LEVELS.DEBUG, origin, message, data),
    trace: (origin, message, data) => Logger._log(LOG_LEVELS.TRACE, origin, message, data),
};

export default Logger;