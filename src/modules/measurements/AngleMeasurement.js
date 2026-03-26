// src/modules/measurements/AngleMeasurement.js
import * as THREE from 'three';
import { BaseMeasurement } from './common/BaseMeasurement.js';

export class AngleMeasurement extends BaseMeasurement {
    constructor(scene, materials, logger, eventBus) {
        // The tool name 'angle' is passed to the base class
        super(scene, materials, logger, eventBus, 'angle');
    }

    /**
     * Overrides the base method to use the correct material for angle points.
     */
    _addPointVisual(point) {
        const geometry = new THREE.SphereGeometry(0.08, 16, 12);
        const material = this.materials.anglePoint; // Use specific angle material
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.copy(point);
        sphere.renderOrder = 999;
        this.scene.add(sphere);
        this.activeMeasurement.visuals.points.push(sphere);
    }

    /**
     * Overrides the base method to use the correct material for angle lines.
     */
    _addLineVisual(startPoint, endPoint) {
        const geometry = new THREE.BufferGeometry().setFromPoints([startPoint, endPoint]);
        const line = new THREE.Line(geometry, this.materials.angleLine); // Use specific angle material
        line.renderOrder = 998;
        this.scene.add(line);
        this.activeMeasurement.visuals.lines.push(line);
    }

    /**
     * Handles the selection of points. An angle measurement is complete when 3 points are selected.
     * @param {THREE.Vector3} point - The point selected by the user.
     */
    _handlePointSelected(point) {
        super._handlePointSelected(point); // Calls the base class method to add the point

        const points = this.activeMeasurement.points;
        
        // Draw a line from the vertex (first point) to the second point
        if (points.length === 2) {
            this._addLineVisual(points[0], points[1]);
        }
        
        // Once three points are selected, complete the measurement
        if (points.length === 3) {
            this._addLineVisual(points[0], points[2]);
            this._completeMeasurement();
        }
    }

    /**
     * Calculates the angle and adds the final visuals.
     * @private
     */
    _completeMeasurement() {
        const [vertex, p1, p2] = this.activeMeasurement.points;

        // Create two vectors from the vertex to the other points
        const v1 = new THREE.Vector3().subVectors(p1, vertex).normalize();
        const v2 = new THREE.Vector3().subVectors(p2, vertex).normalize();

        // Calculate the angle in radians using the dot product, then convert to degrees
        const angleRad = Math.acos(v1.dot(v2));
        const angleDeg = THREE.MathUtils.radToDeg(angleRad);

        this.activeMeasurement.value = angleDeg;
        this.activeMeasurement.finished = true;
        
        // Add a label at the vertex of the angle
        const labelPosition = vertex.clone().add(new THREE.Vector3(0, 0.2, 0)); // Slight offset
        this._addLabel(`${angleDeg.toFixed(2)}°`, labelPosition, '#ffff00'); // Yellow for angles

        this.logger.info(`AngleMeasurement: Completed - ${angleDeg.toFixed(2)}°`);
        
        // Notify the application that the measurement is complete
        this.eventBus.emit('measurement:angle:completed', { measurement: this.activeMeasurement });
        this.activeMeasurement = null;
    }
}
