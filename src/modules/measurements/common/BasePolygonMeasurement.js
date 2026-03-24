// src/modules/measurements/common/BasePolygonMeasurement.js
// Polygon measurements using Cesium entities

import { BaseMeasurement } from './BaseMeasurement.js';

export class BasePolygonMeasurement extends BaseMeasurement {
    constructor(viewer, colors, logger, eventBus, toolName, pointColor, lineColor) {
        super(viewer, colors, logger, eventBus, toolName);
        this.pointColor = pointColor;
        this.lineColor = lineColor;

        this.eventBus.on('measurement:area:finish', () => {
            if (this.activeMeasurement && this.toolName === this.activeMeasurement.type) {
                this._finishMeasurement();
            }
        });
    }

    _addPointVisual(point) {
        return super._addPointVisual(point, this.pointColor);
    }

    _addLineVisual(p1, p2) {
        return super._addLineVisual(p1, p2, this.lineColor);
    }

    _handlePointSelected(point) {
        if (!this.activeMeasurement) this._startMeasurement();

        this.activeMeasurement.points.push(point);
        this._addPointVisual(point);

        const pts = this.activeMeasurement.points;
        if (pts.length > 1) {
            this._addLineVisual(pts[pts.length - 2], pts[pts.length - 1]);
        }
        if (pts.length >= 2) {
            this._updatePreviewLine();
        }
    }

    _updatePreviewLine() {
        if (this.activeMeasurement.visuals.previewLine) {
            this.viewer.entities.remove(this.activeMeasurement.visuals.previewLine);
        }
        const pts = this.activeMeasurement.points;
        const entity = this.viewer.entities.add({
            polyline: {
                positions: [pts[pts.length - 1], pts[0]],
                width: 1,
                material: new Cesium.PolylineDashMaterialProperty({
                    color: this.colors.previewLine
                }),
                depthFailMaterial: new Cesium.PolylineDashMaterialProperty({
                    color: this.colors.previewLine.withAlpha(0.3)
                })
            }
        });
        this.activeMeasurement.visuals.previewLine = entity;
    }

    _finishMeasurement() {
        if (!this.activeMeasurement || this.activeMeasurement.points.length < 3) {
            this.logger.warn(`${this.constructor.name}: Requires at least 3 points.`);
            if (this.activeMeasurement) this.cancelActiveMeasurement();
            return;
        }

        // Remove preview line
        if (this.activeMeasurement.visuals.previewLine) {
            this.viewer.entities.remove(this.activeMeasurement.visuals.previewLine);
            this.activeMeasurement.visuals.previewLine = null;
        }

        // Closing line
        const pts = this.activeMeasurement.points;
        this._addLineVisual(pts[pts.length - 1], pts[0]);
    }

    // --- Polygon fill ---

    _addFillPolygon(points, color) {
        const entity = this.viewer.entities.add({
            polygon: {
                hierarchy: new Cesium.PolygonHierarchy(points),
                material: color,
                perPositionHeight: true
            }
        });
        this.activeMeasurement.visuals.fill = entity;
        return entity;
    }

    // --- Centroid helper (pure Cesium math) ---

    _centroid(points) {
        const sum = points.reduce(
            (acc, p) => Cesium.Cartesian3.add(acc, p, new Cesium.Cartesian3()),
            new Cesium.Cartesian3()
        );
        return new Cesium.Cartesian3(
            sum.x / points.length,
            sum.y / points.length,
            sum.z / points.length
        );
    }

    // --- Triangle area (pure Cartesian3) ---

    _triangleArea(p0, p1, p2) {
        const v1 = Cesium.Cartesian3.subtract(p1, p0, new Cesium.Cartesian3());
        const v2 = Cesium.Cartesian3.subtract(p2, p0, new Cesium.Cartesian3());
        const cross = Cesium.Cartesian3.cross(v1, v2, new Cesium.Cartesian3());
        return Cesium.Cartesian3.magnitude(cross) * 0.5;
    }

    _calculatePolygonArea(points) {
        let total = 0;
        for (let i = 1; i < points.length - 1; i++) {
            total += this._triangleArea(points[0], points[i], points[i + 1]);
        }
        return total;
    }
}
