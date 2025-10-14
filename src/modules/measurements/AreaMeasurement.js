import * as THREE from 'three';
import { BasePolygonMeasurement } from './common/BasePolygonMeasurement.js';

export class AreaMeasurement extends BasePolygonMeasurement {
    constructor(scene, materials, logger, eventBus) {
        super(scene, materials, logger, eventBus, 'area');
    }

    _finishMeasurement() {
        super._finishMeasurement(); // Handles cleanup and adding the closing line
        if (!this.activeMeasurement) return; // Finish was cancelled

        const points = this.activeMeasurement.points;
        const area = this._calculate3DPolygonArea(points);
        this.activeMeasurement.value = area;
        this.activeMeasurement.finished = true;

        this._addFillMesh(points);
        this._addAreaLabel(points, area);

        this.logger.info(`AreaMeasurement: Completed - ${area.toFixed(2)}m²`);
        this.eventBus.emit('measurement:area:completed', { measurement: this.activeMeasurement });
        this.activeMeasurement = null;
    }

    _addFillMesh(points) {
        const shape = new THREE.Shape(points.map(p => new THREE.Vector2(p.x, p.y))); // Simple 2D projection for fill
        const geometry = new THREE.ShapeGeometry(shape);
        const mesh = new THREE.Mesh(geometry, this.materials.areaFill);
        this.scene.add(mesh);
        this.activeMeasurement.visuals.fill = mesh;
    }

    _addAreaLabel(points, area) {
        const center = new THREE.Vector3();
        points.forEach(p => center.add(p));
        center.divideScalar(points.length);
        this._addLabel(`${area.toFixed(2)}m²`, center.add(new THREE.Vector3(0, 0.2, 0)), '#00ff00');
    }

    _calculate3DPolygonArea(points) {
        if (points.length < 3) return 0;
        let area = 0;
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            area += points[i].x * points[j].y;
            area -= points[j].x * points[i].y;
        }
        return Math.abs(area) / 2;
    }
}