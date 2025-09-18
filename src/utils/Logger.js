/**
 * @module Logger
 * @description
 * Provides a centralized logging system for the entire application.
 * This helps in debugging and understanding the application flow.
 */
export class Logger {
    /**
     * @param {string} logLevel - The minimum log level to display ('DEBUG', 'INFO', 'WARN', 'ERROR').
     */
    constructor(logLevel = 'INFO') {
        this.logLevel = logLevel;
        this.levels = {
            'DEBUG': 1,
            'INFO': 2,
            'WARN': 3,
            'ERROR': 4,
        };
    }

    /**
     * Internal log method to handle message formatting and level checking.
     * @param {string} level - The level of the log message.
     * @param {string} message - The main log message.
     * @param {*} [data=''] - Optional data to log alongside the message.
     * @private
     */
    _log(level, message, data = '') {
        if (this.levels[level] >= this.levels[this.logLevel]) {
            const timestamp = new Date().toLocaleTimeString();
            console.log(`[${level}] [${timestamp}] - ${message}`, data);
        }
    }

    /**
     * Logs a debug message. Use for detailed diagnostic information.
     * @param {string} message - The message to log.
     * @param {*} [data] - Optional data.
     */
    debug(message, data) {
        this._log('DEBUG', message, data);
    }

    /**
     * Logs an info message. Use for general application flow information.
     * @param {string} message - The message to log.
     * @param {*} [data] - Optional data.
     */
    info(message, data) {
        this._log('INFO', message, data);
    }

    /**
     * Logs a warning message. Use for potential issues that don't break the app.
     * @param {string} message - The message to log.
     * @param {*} [data] - Optional data.
     */
    warn(message, data) {
        this._log('WARN', message, data);
    }

    /**
     * Logs an error message. Use for critical failures.
     * @param {string} message - The message to log.
     * @param {*} [data] - Optional data.
     */
    error(message, data) {
        this._log('ERROR', message, data);
    }
}
