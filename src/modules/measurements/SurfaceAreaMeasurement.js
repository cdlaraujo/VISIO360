// src/modules/measurements/SurfaceAreaMeasurement.js
// Note: 3D surface area from mesh geometry is not yet available for Cesium 3D Tiles.
// For now, calculates the projected polygon area (same as AreaMeasurement).
import { BasePolygonMeasurement } from './common/BasePolygonMeasurement.js';

export class SurfaceAreaMeasurement extends BasePolygonMeasurement {
    constructor(viewer, colors, logger, eventBus) {
        super(viewer, colors, logger, eventBus, 'surfaceArea',
            colors.surfaceAreaPoint, colors.surfaceAreaLine);
    }

    _finishMeasurement() {
        super._finishMeasurement();
        if (!this.activeMeasurement) return;

        const pts = this.activeMeasurement.points;
        const area = this._calculatePolygonArea(pts);

        this.activeMeasurement.value = area;
        this.activeMeasurement.finished = true;

        this._addFillPolygon(pts, this.colors.surfaceAreaLine.withAlpha(0.3));

        const center = this._centroid(pts);
        this._addLabel(`~${area.toFixed(2)}m²`, center, '#00aaff');

        this.logger.info(`SurfaceAreaMeasurement: ~${area.toFixed(2)}m² (projected)`);
        this.eventBus.emit('measurement:surfaceArea:completed', { measurement: this.activeMeasurement });
        this.activeMeasurement = null;
    }
}
