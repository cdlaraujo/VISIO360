// src/utils/Logger.js
const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
};

// Defina o nível de log que você quer ver. INFO é um bom padrão.
const CURRENT_LOG_LEVEL = LOG_LEVELS.INFO;

class Logger {
    constructor(context) {
        this.context = context;
    }

    _log(level, message, ...args) {
        if (LOG_LEVELS[level] < CURRENT_LOG_LEVEL) {
            return;
        }

        const timestamp = new Date().toISOString();
        const levelName = `[${level}]`;
        const contextName = `(${this.context})`;

        console.log(`${timestamp} ${levelName} ${contextName} - ${message}`, ...args);
    }

    info(message, ...args) {
        this._log('INFO', message, ...args);
    }

    warn(message, ...args) {
        this._log('WARN', message, ...args);
    }

    error(message, ...args) {
        this._log('ERROR', message, ...args);
    }

    debug(message, ...args) {
        this._log('DEBUG', message, ...args);
    }
}

export default Logger;
