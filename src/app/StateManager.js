/**
 * @class StateManager
 * @description
 * Centralized, minimal state store for key application variables.
 * Implements a basic Publish/Subscribe pattern for specific state changes,
 * ensuring a single source of truth for global values like the active tool.
 */
export class StateManager {
    constructor(logger) {
        this.logger = logger;
        this.state = {
            activeTool: 'none', // The single source of truth for the active tool
        };
        this.subscriptions = {
            activeTool: [],
        };

        this.logger.info('StateManager: Initialized.');
    }

    /**
     * Gets a specific piece of state.
     * @param {string} key - The state key (e.g., 'activeTool').
     * @returns {*} The current value of the state key.
     */
    getState(key) {
        return this.state[key];
    }

    /**
     * Sets a specific piece of state and notifies subscribers if it changed.
     * @param {string} key - The state key to set.
     * @param {*} value - The new value.
     */
    setState(key, value) {
        if (this.state[key] !== value) {
            const oldValue = this.state[key];
            this.state[key] = value;
            
            this.logger.debug(`StateManager: State updated - ${key}: "${oldValue}" -> "${value}"`);
            
            // Notify subscribers for this specific key
            if (this.subscriptions[key]) {
                this.subscriptions[key].forEach(callback => {
                    // Provide the new value to the callback for reactivity
                    callback(value);
                });
            }
        }
    }

    /**
     * Subscribes a callback function to changes on a specific state key.
     * @param {string} key - The state key to subscribe to.
     * @param {Function} callback - The function to call when the state changes.
     */
    subscribe(key, callback) {
        if (!this.subscriptions[key]) {
            this.subscriptions[key] = [];
            this.logger.warn(`StateManager: Subscription array for key "${key}" was initialized on demand.`);
        }
        this.subscriptions[key].push(callback);
        
        // Immediately run the callback with the current state for initialization
        callback(this.state[key]);
        
        this.logger.debug(`StateManager: Subscriber registered for key "${key}".`);
    }
}
