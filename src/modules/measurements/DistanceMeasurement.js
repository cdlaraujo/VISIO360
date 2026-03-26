import * as THREE from 'three';
import { BaseMeasurement } from './common/BaseMeasurement.js';

export class DistanceMeasurement extends BaseMeasurement {
    constructor(scene, materials, logger, eventBus) {
        super(scene, materials, logger, eventBus, 'measure'); // Pass the tool name
    }

    _handlePointSelected(point) {
        super._handlePointSelected(point); // Calls the base class method

        if (this.activeMeasurement.points.length === 2) {
            this._completeMeasurement();
        }
    }

    _completeMeasurement() {
        const [startPoint, endPoint] = this.activeMeasurement.points;
        const distance = startPoint.distanceTo(endPoint);

        this.activeMeasurement.value = distance; // Use 'value' for consistency
        this.activeMeasurement.finished = true;

        this._addLineVisual(startPoint, endPoint);

        const midPoint = new THREE.Vector3().addVectors(startPoint, endPoint).multiplyScalar(0.5);
        this._addLabel(`${distance.toFixed(2)}m`, midPoint.add(new THREE.Vector3(0, 0.2, 0)), '#ff0000');

        this.logger.info(`DistanceMeasurement: Completed - ${distance.toFixed(2)}m`);
        this.eventBus.emit('measurement:distance:completed', { measurement: this.activeMeasurement });
        this.activeMeasurement = null;
    }
}