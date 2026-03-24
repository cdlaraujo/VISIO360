// src/modules/measurements/VolumeMeasurement.js
// Note: Cut/fill volume calculation from 3D Tiles mesh not yet available.
// Shows polygon boundary and logs a placeholder until Cesium terrain sampling is implemented.
import { BasePolygonMeasurement } from './common/BasePolygonMeasurement.js';

export class VolumeMeasurement extends BasePolygonMeasurement {
    constructor(viewer, colors, logger, eventBus) {
        super(viewer, colors, logger, eventBus, 'volume', colors.volumePoint, colors.volumeLine);
    }

    _finishMeasurement() {
        super._finishMeasurement();
        if (!this.activeMeasurement) return;

        const pts = this.activeMeasurement.points;

        this.activeMeasurement.value = 0;
        this.activeMeasurement.finished = true;

        this._addFillPolygon(pts, this.colors.volumeFill);

        const center = this._centroid(pts);
        this._addLabel('Vol: N/A', center, '#ff00ff');

        this.logger.warn('VolumeMeasurement: Volume calculation from 3D Tiles not yet implemented.');
        this.eventBus.emit('measurement:volume:completed', { measurement: this.activeMeasurement });
        this.activeMeasurement = null;
    }
}
