// src/modules/measurements/AreaMeasurement.js

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
        const area = this._calculateProjectedPolygonArea(points); // Reverted to the correct projected area calculation
        this.activeMeasurement.value = area;
        this.activeMeasurement.finished = true;

        this._addFillMesh(points);
        this._addAreaLabel(points, area);

        this.logger.info(`AreaMeasurement: Completed - Projected Area = ${area.toFixed(2)}m²`);
        this.eventBus.emit('measurement:area:completed', { measurement: this.activeMeasurement });
        this.activeMeasurement = null;
    }

    _addFillMesh(points) {
        const centroid = new THREE.Vector3();
        points.forEach(p => centroid.add(p));
        centroid.divideScalar(points.length);

        const p1 = points[0];
        const p2 = points[1];
        const p3 = points[2];
        
        const edge1 = new THREE.Vector3().subVectors(p2, p1);
        const edge2 = new THREE.Vector3().subVectors(p3, p1);
        const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();

        const xAxis = new THREE.Vector3().subVectors(p2, p1).normalize();
        const yAxis = new THREE.Vector3().crossVectors(normal, xAxis).normalize();
        
        const shape = new THREE.Shape(
            points.map(p => {
                const vector = new THREE.Vector3().subVectors(p, centroid);
                return new THREE.Vector2(vector.dot(xAxis), vector.dot(yAxis));
            })
        );

        const geometry = new THREE.ShapeGeometry(shape);
        const mesh = new THREE.Mesh(geometry, this.materials.areaFill);
        
        mesh.position.copy(centroid);
        
        const orientationMatrix = new THREE.Matrix4().makeBasis(xAxis, yAxis, normal);
        const orientationQuaternion = new THREE.Quaternion().setFromRotationMatrix(orientationMatrix);
        mesh.quaternion.copy(orientationQuaternion);

        mesh.renderOrder = 997; 

        this.scene.add(mesh);
        this.activeMeasurement.visuals.fill = mesh;
    }

    _addAreaLabel(points, area) {
        const center = new THREE.Vector3();
        points.forEach(p => center.add(p));
        center.divideScalar(points.length);
        this._addLabel(`${area.toFixed(2)}m²`, center.add(new THREE.Vector3(0, 0.2, 0)), '#00ff00');
    }

    /**
     * ✅ CORRECTED: Calculates the PROJECTED area of a 3D polygon onto the XY plane.
     * This uses the standard 2D shoelace algorithm, ignoring the Z component, which is the
     * correct method for calculating planimetric area.
     * @param {THREE.Vector3[]} points - The 3D vertices of the polygon.
     * @returns {number} The calculated 2D projected area.
     */
    _calculateProjectedPolygonArea(points) {
        if (points.length < 3) return 0;
        let area = 0;
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            // Uses only X and Y coordinates to get the projected area
            area += points[i].x * points[j].y;
            area -= points[j].x * points[i].y;
        }
        return Math.abs(area) / 2;
    }
}