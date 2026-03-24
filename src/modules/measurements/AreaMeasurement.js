// src/modules/measurements/AreaMeasurement.js
import { BasePolygonMeasurement } from './common/BasePolygonMeasurement.js';

export class AreaMeasurement extends BasePolygonMeasurement {
    constructor(viewer, colors, logger, eventBus) {
        super(viewer, colors, logger, eventBus, 'area', colors.areaPoint, colors.areaLine);
    }

    _finishMeasurement() {
        super._finishMeasurement();
        if (!this.activeMeasurement) return;

        const pts = this.activeMeasurement.points;
        const area = this._calculatePolygonArea(pts);

        this.activeMeasurement.value = area;
        this.activeMeasurement.finished = true;

        this._addFillPolygon(pts, this.colors.areaFill);

        const center = this._centroid(pts);
        this._addLabel(`${area.toFixed(2)}m²`, center, '#00ff00');

        this.logger.info(`AreaMeasurement: ${area.toFixed(2)}m²`);
        this.eventBus.emit('measurement:area:completed', { measurement: this.activeMeasurement });
        this.activeMeasurement = null;
    }
}
