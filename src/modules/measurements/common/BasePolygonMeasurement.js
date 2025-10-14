import * as THREE from 'three';
import { BaseMeasurement } from './BaseMeasurement.js';

/**
 * @class BasePolygonMeasurement
 * @description An abstract base class for polygon-based measurement tools (e.g., Area, SurfaceArea).
 * Inherits from BaseMeasurement and adds logic for creating multi-point shapes.
 */
export class BasePolygonMeasurement extends BaseMeasurement {
    constructor(scene, materials, logger, eventBus, toolName) {
        super(scene, materials, logger, eventBus, toolName);

        // Listen for the event to finish the polygon
        this.eventBus.on('measurement:area:finish', () => {
            if (this.activeMeasurement && this.toolName === this.activeMeasurement.type) {
                this._finishMeasurement();
            }
        });
    }

    _handlePointSelected(point) {
        super._handlePointSelected(point);

        const points = this.activeMeasurement.points;
        if (points.length > 1) {
            // Add a line from the previous point to the new one
            this._addLineVisual(points[points.length - 2], points[points.length - 1]);
        }
        if (points.length >= 2) {
            // Update the dashed "preview" line that shows the closing segment
            this._updatePreviewLine();
        }
    }

    _updatePreviewLine() {
        if (this.activeMeasurement.visuals.previewLine) {
            this.scene.remove(this.activeMeasurement.visuals.previewLine);
            this.activeMeasurement.visuals.previewLine.geometry.dispose();
        }

        const firstPoint = this.activeMeasurement.points[0];
        const lastPoint = this.activeMeasurement.points[this.activeMeasurement.points.length - 1];

        const geometry = new THREE.BufferGeometry().setFromPoints([lastPoint, firstPoint]);
        const line = new THREE.Line(geometry, this.materials.previewLine);
        line.computeLineDistances();
        this.scene.add(line);
        this.activeMeasurement.visuals.previewLine = line;
    }

    _finishMeasurement() {
        if (!this.activeMeasurement || this.activeMeasurement.points.length < 3) {
            this.logger.warn(`${this.constructor.name}: Cannot finish, requires at least 3 points.`);
            return;
        }

        // Clean up the preview line
        if (this.activeMeasurement.visuals.previewLine) {
            this.scene.remove(this.activeMeasurement.visuals.previewLine);
            this.activeMeasurement.visuals.previewLine.geometry.dispose();
            this.activeMeasurement.visuals.previewLine = null;
        }

        // Add the final closing line
        const points = this.activeMeasurement.points;
        this._addLineVisual(points[points.length - 1], points[0]);

        // Child classes will implement their specific calculation and labeling
    }
}