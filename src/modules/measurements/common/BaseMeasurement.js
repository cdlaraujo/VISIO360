import * as THREE from 'three';
import { createTextSprite } from '../../../utils/DrawingUtils.js'; // Assuming DrawingUtils.js exists

/**
 * @class BaseMeasurement
 * @description An abstract base class for measurement tools.
 * Handles common logic for point selection, visual creation, and lifecycle management.
 */
export class BaseMeasurement {
    constructor(scene, materials, logger, eventBus, toolName) {
        this.scene = scene;
        this.materials = materials;
        this.logger = logger;
        this.eventBus = eventBus;
        this.toolName = toolName; // e.g., 'measure', 'area'

        this.measurements = [];
        this.activeMeasurement = null;

        this._setupEventListeners();
    }

    _setupEventListeners() {
        this.eventBus.on('measurement:point:selected', (payload) => {
            if (payload.tool === this.toolName) {
                this._handlePointSelected(payload.point);
            }
        });
    }

    _handlePointSelected(point) {
        if (!this.activeMeasurement) {
            this._startMeasurement();
        }
        this.activeMeasurement.points.push(point);
        this._addPointVisual(point);
    }

    _startMeasurement() {
        this.activeMeasurement = {
            id: this._generateId(),
            type: this.toolName,
            points: [],
            visuals: { points: [], lines: [], fill: null, previewLine: null, labels: [] },
            finished: false
        };
        this.measurements.push(this.activeMeasurement);
        this.logger.info(`${this.constructor.name}: Started new measurement.`);
    }

    // --- Visual Creation Methods ---

    _addPointVisual(point) {
        const geometry = new THREE.SphereGeometry(0.08, 16, 12);
        const material = this.materials.point; // Default material
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.copy(point);
        sphere.renderOrder = 999;
        this.scene.add(sphere);
        this.activeMeasurement.visuals.points.push(sphere);
    }

    _addLineVisual(startPoint, endPoint) {
        const geometry = new THREE.BufferGeometry().setFromPoints([startPoint, endPoint]);
        const line = new THREE.Line(geometry, this.materials.line); // Default material
        line.renderOrder = 998;
        this.scene.add(line);
        this.activeMeasurement.visuals.lines.push(line);
    }

    _addLabel(text, position, color = '#ffffff') {
        const label = createTextSprite(text, color);
        label.position.copy(position);
        this.scene.add(label);
        this.activeMeasurement.visuals.labels.push(label);
    }

    // --- Lifecycle Methods ---

    cancelActiveMeasurement() {
        if (this.activeMeasurement && !this.activeMeasurement.finished) {
            // The disposer will handle removing visuals from the scene
            this.eventBus.emit('measurement:delete', { id: this.activeMeasurement.id });
            this.activeMeasurement = null;
            this.logger.info(`${this.constructor.name}: Active measurement cancelled.`);
        }
    }

    getFinishedMeasurements() {
        return this.measurements
            .filter(m => m.finished)
            .map(m => ({ id: m.id, value: m.value })); // Expects a 'value' property
    }

    getMeasurementById(id) {
        return this.measurements.find(m => m.id === id);
    }

    _generateId() {
        return `${this.toolName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}