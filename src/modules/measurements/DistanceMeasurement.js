// src/modules/measurements/DistanceMeasurement.js
import { BaseMeasurement } from './common/BaseMeasurement.js';

export class DistanceMeasurement extends BaseMeasurement {
    constructor(viewer, colors, logger, eventBus) {
        super(viewer, colors, logger, eventBus, 'measure');
    }

    _handlePointSelected(point) {
        super._handlePointSelected(point);
        if (this.activeMeasurement.points.length === 2) {
            this._completeMeasurement();
        }
    }

    _completeMeasurement() {
        const [p1, p2] = this.activeMeasurement.points;
        const distance = Cesium.Cartesian3.distance(p1, p2);

        this.activeMeasurement.value = distance;
        this.activeMeasurement.finished = true;

        this._addLineVisual(p1, p2);

        const mid = Cesium.Cartesian3.midpoint(p1, p2, new Cesium.Cartesian3());
        this._addLabel(`${distance.toFixed(2)}m`, mid, '#ff4444');

        this.logger.info(`DistanceMeasurement: ${distance.toFixed(2)}m`);
        this.eventBus.emit('measurement:distance:completed', { measurement: this.activeMeasurement });
        this.activeMeasurement = null;
    }
}
