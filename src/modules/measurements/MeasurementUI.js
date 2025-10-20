// src/modules/measurements/MeasurementUI.js (New Worker File)

/**
 * @class MeasurementUI
 * @description
 * Worker module responsible for orchestrating the update of the Measurements UI panel.
 * Its sole purpose is to fetch data from the Measurements coordinator and emit
 * a low-level UI render command.
 */
export class MeasurementUI {
    constructor(eventBus, manager) {
        this.eventBus = eventBus;
        this.manager = manager; // The main Measurements coordinator

        this._setupEventListeners();
    }

    _setupEventListeners() {
        // NOTE: The logic for updating tool instructions has been moved to UIManager.js,
        // which now subscribes directly to StateManager for greater efficiency.
        // This module no longer needs to listen to tool changes.
    }

    /**
     * Fetches the latest measurement stats and tells the main UI to render them.
     */
    update() {
        const stats = this.manager.getMeasurementStats();
        this.eventBus.emit('ui:measurements:update', stats);
    }
}
