// ============================================================================
// FILE: src/modules/measurements/DistanceMeasurement.js
// ============================================================================

import * as THREE from 'three';

/**
 * @class DistanceMeasurement
 * @description Handles distance measurement functionality between two points.
 * Single Responsibility: Manage distance measurements only.
 */
export class DistanceMeasurement {
    constructor(scene, materials, logger, eventBus) {
        this.scene = scene;
        this.materials = materials;
        this.logger = logger;
        this.eventBus = eventBus;
        
        this.measurements = [];
        this.activeMeasurement = null;
        
        this._setupEventListeners();
    }

    _setupEventListeners() {
        this.eventBus.on('measurement:point:selected', (payload) => {
            if (payload.tool === 'measure') {
                this._handlePointSelected(payload.point);
            }
        });
    }

    _handlePointSelected(point) {
        if (!this.activeMeasurement) {
            this._startMeasurement(point);
        } else if (this.activeMeasurement.points.length === 1) {
            this._completeMeasurement(point);
        }
    }

    _startMeasurement(firstPoint) {
        this.activeMeasurement = {
            id: this._generateId(),
            type: 'distance',
            points: [firstPoint],
            visuals: { points: [], lines: [], labels: [] },
            finished: false
        };

        this.measurements.push(this.activeMeasurement);
        this._addPointVisual(firstPoint);
        
        this.logger.info('DistanceMeasurement: Started new distance measurement');
    }

    _completeMeasurement(secondPoint) {
        this.activeMeasurement.points.push(secondPoint);
        this._addPointVisual(secondPoint);
        
        const distance = this.activeMeasurement.points[0].distanceTo(secondPoint);
        this.activeMeasurement.distance = distance;
        this.activeMeasurement.finished = true;
        
        this._addLineVisual(this.activeMeasurement.points[0], secondPoint);
        this._addDistanceLabel(distance, this.activeMeasurement.points[0], secondPoint);
        
        this.logger.info(`DistanceMeasurement: Completed - ${distance.toFixed(2)}m`);
        this.eventBus.emit('measurement:distance:completed', { 
            measurement: this.activeMeasurement 
        });
        
        this.activeMeasurement = null;
    }

    _addPointVisual(point) {
        const geometry = new THREE.SphereGeometry(0.08, 16, 12);
        const sphere = new THREE.Mesh(geometry, this.materials.point);
        sphere.position.copy(point);
        sphere.renderOrder = 999;
        this.scene.add(sphere);
        this.activeMeasurement.visuals.points.push(sphere);
    }

    _addLineVisual(startPoint, endPoint) {
        const geometry = new THREE.BufferGeometry().setFromPoints([startPoint, endPoint]);
        const line = new THREE.Line(geometry, this.materials.line);
        line.renderOrder = 998;
        this.scene.add(line);
        this.activeMeasurement.visuals.lines.push(line);
    }

    _addDistanceLabel(distance, startPoint, endPoint) {
        const midPoint = new THREE.Vector3()
            .addVectors(startPoint, endPoint)
            .multiplyScalar(0.5);
        
        const text = `${distance.toFixed(2)}m`;
        const label = this._createTextSprite(text, '#ff0000');
        
        // ✅ FIX: Position the label at the midpoint with a slight vertical offset to ensure it's visible.
        label.position.copy(midPoint).add(new THREE.Vector3(0, 0.2, 0));
        
        this.scene.add(label);
        this.activeMeasurement.visuals.labels.push(label);
    }

    _createTextSprite(text, color) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 128;
        context.fillStyle = 'rgba(0, 0, 0, 0.7)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.font = 'Bold 48px Arial';
        context.fillStyle = color;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width / 2, canvas.height / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ 
            map: texture, 
            depthTest: false, 
            depthWrite: false 
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        
        sprite.scale.set(1.2, 0.3, 1.0);
        sprite.renderOrder = 1000;
        return sprite;
    }

    cancelActiveMeasurement() {
        if (this.activeMeasurement) {
            this.activeMeasurement.visuals.points.forEach(point => {
                this.scene.remove(point);
                point.geometry.dispose();
            });
            
            const index = this.measurements.indexOf(this.activeMeasurement);
            if (index > -1) {
                this.measurements.splice(index, 1);
            }
            
            this.activeMeasurement = null;
            this.logger.info('DistanceMeasurement: Active measurement cancelled');
        }
    }

    getFinishedMeasurements() {
        return this.measurements
            .filter(m => m.finished)
            .map(m => ({ id: m.id, value: m.distance }));
    }

    getMeasurementById(id) {
        return this.measurements.find(m => m.id === id);
    }

    _generateId() {
        return `distance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}