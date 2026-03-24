// src/modules/measurements/AngleMeasurement.js
import { BaseMeasurement } from './common/BaseMeasurement.js';

export class AngleMeasurement extends BaseMeasurement {
    constructor(viewer, colors, logger, eventBus) {
        super(viewer, colors, logger, eventBus, 'angle');
    }

    _addPointVisual(point) {
        return super._addPointVisual(point, this.colors.anglePoint);
    }

    _addLineVisual(p1, p2) {
        return super._addLineVisual(p1, p2, this.colors.angleLine);
    }

    _handlePointSelected(point) {
        super._handlePointSelected(point);
        const pts = this.activeMeasurement.points;

        if (pts.length === 2) this._addLineVisual(pts[0], pts[1]);
        if (pts.length === 3) {
            this._addLineVisual(pts[0], pts[2]);
            this._completeMeasurement();
        }
    }

    _completeMeasurement() {
        const [vertex, p1, p2] = this.activeMeasurement.points;

        const v1 = Cesium.Cartesian3.normalize(
            Cesium.Cartesian3.subtract(p1, vertex, new Cesium.Cartesian3()),
            new Cesium.Cartesian3()
        );
        const v2 = Cesium.Cartesian3.normalize(
            Cesium.Cartesian3.subtract(p2, vertex, new Cesium.Cartesian3()),
            new Cesium.Cartesian3()
        );
        const dot = Cesium.Cartesian3.dot(v1, v2);
        const angleDeg = Cesium.Math.toDegrees(Math.acos(Math.max(-1, Math.min(1, dot))));

        this.activeMeasurement.value = angleDeg;
        this.activeMeasurement.finished = true;

        this._addLabel(`${angleDeg.toFixed(2)}°`, vertex, '#ffff00');

        this.logger.info(`AngleMeasurement: ${angleDeg.toFixed(2)}°`);
        this.eventBus.emit('measurement:angle:completed', { measurement: this.activeMeasurement });
        this.activeMeasurement = null;
    }
}
