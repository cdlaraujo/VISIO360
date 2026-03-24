// src/modules/measurements/VolumeBoxMeasurement.js
import { BaseMeasurement } from './common/BaseMeasurement.js';

export class VolumeBoxMeasurement extends BaseMeasurement {
    constructor(viewer, colors, logger, eventBus) {
        super(viewer, colors, logger, eventBus, 'volumeBox');
    }

    _addPointVisual(point) {
        return super._addPointVisual(point, this.colors.volumeBoxPoint);
    }

    _handlePointSelected(point) {
        super._handlePointSelected(point);
        if (this.activeMeasurement.points.length === 2) {
            this._completeMeasurement();
        }
    }

    _completeMeasurement() {
        const [p1, p2] = this.activeMeasurement.points;

        const dx = Math.abs(p2.x - p1.x);
        const dy = Math.abs(p2.y - p1.y);
        const dz = Math.abs(p2.z - p1.z);
        const volume = dx * dy * dz;

        this.activeMeasurement.value = volume;
        this.activeMeasurement.finished = true;

        // Draw bounding box as 4 lines
        this._addLineVisual(p1, new Cesium.Cartesian3(p2.x, p1.y, p1.z), this.colors.volumeBox);
        this._addLineVisual(p1, new Cesium.Cartesian3(p1.x, p2.y, p1.z), this.colors.volumeBox);
        this._addLineVisual(p1, new Cesium.Cartesian3(p1.x, p1.y, p2.z), this.colors.volumeBox);
        this._addLineVisual(p2, new Cesium.Cartesian3(p1.x, p2.y, p2.z), this.colors.volumeBox);
        this._addLineVisual(p2, new Cesium.Cartesian3(p2.x, p1.y, p2.z), this.colors.volumeBox);
        this._addLineVisual(p2, new Cesium.Cartesian3(p2.x, p2.y, p1.z), this.colors.volumeBox);

        const center = Cesium.Cartesian3.midpoint(p1, p2, new Cesium.Cartesian3());
        this._addLabel(`${volume.toFixed(2)}m³`, center, '#00ccff');

        this.logger.info(`VolumeBoxMeasurement: ${volume.toFixed(2)}m³`);
        this.eventBus.emit('measurement:volumeBox:completed', { measurement: this.activeMeasurement });
        this.activeMeasurement = null;
    }
}
