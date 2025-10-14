// ============================================================================
// FILE: src/modules/measurements/SurfaceAreaMeasurement.js
// ============================================================================

import * as THREE from 'three';
import { SurfaceAreaCalculator } from './SurfaceAreaCalculator.js';

/**
 * @class SurfaceAreaMeasurement
 * @description Handles surface area measurement (actual model surface within polygon).
 * Single Responsibility: Manage surface area measurements only.
 */
export class SurfaceAreaMeasurement {
    constructor(scene, materials, logger, eventBus) {
        this.scene = scene;
        this.materials = materials;
        this.logger = logger;
        this.eventBus = eventBus;
        
        this.measurements = [];
        this.activeMeasurement = null;
        this.activeModel = null;
        
        this.calculator = new SurfaceAreaCalculator(logger);
        
        this._setupEventListeners();
    }

    _setupEventListeners() {
        this.eventBus.on('measurement:point:selected', (payload) => {
            if (payload.tool === 'surfaceArea') {
                this._handlePointSelected(payload.point);
            }
        });

        this.eventBus.on('measurement:area:finish', () => {
            this._finishMeasurement();
        });

        this.eventBus.on('model:loaded', (payload) => {
            this.activeModel = payload.model;
        });
    }

    _handlePointSelected(point) {
        if (!this.activeMeasurement) {
            this._startMeasurement();
        }

        this.activeMeasurement.points.push(point);
        this._addPointVisual(point);

        if (this.activeMeasurement.points.length > 1) {
            const prevPoint = this.activeMeasurement.points[
                this.activeMeasurement.points.length - 2
            ];
            this._addLineVisual(prevPoint, point);
        }

        if (this.activeMeasurement.points.length >= 2) {
            this._updatePreviewLine();
        }

        this.logger.debug(`SurfaceAreaMeasurement: Point ${this.activeMeasurement.points.length} added`);
    }

    _startMeasurement() {
        this.activeMeasurement = {
            id: this._generateId(),
            type: 'surfaceArea',
            points: [],
            visuals: { points: [], lines: [], fill: null, previewLine: null, labels: [] },
            finished: false
        };

        this.measurements.push(this.activeMeasurement);
        this.logger.info('SurfaceAreaMeasurement: Started new surface area measurement');
    }

    _finishMeasurement() {
        if (!this.activeMeasurement || this.activeMeasurement.points.length < 3) {
            this.logger.warn('SurfaceAreaMeasurement: Cannot finish - need at least 3 points');
            return;
        }

        if (!this.activeModel) {
            this.logger.error('SurfaceAreaMeasurement: No model loaded for surface area calculation');
            return;
        }

        if (this.activeMeasurement.visuals.previewLine) {
            this.scene.remove(this.activeMeasurement.visuals.previewLine);
            this.activeMeasurement.visuals.previewLine.geometry.dispose();
            this.activeMeasurement.visuals.previewLine = null;
        }

        const firstPoint = this.activeMeasurement.points[0];
        const lastPoint = this.activeMeasurement.points[
            this.activeMeasurement.points.length - 1
        ];
        this._addLineVisual(lastPoint, firstPoint);

        const result = this.calculator.calculateSurfaceArea(
            this.activeModel,
            this.activeMeasurement.points
        );

        this.activeMeasurement.surfaceArea = result.surfaceArea;
        this.activeMeasurement.finished = true;

        if (result.highlightedGeometry) {
            const mesh = new THREE.Mesh(result.highlightedGeometry, this.materials.highlightedFaces);
            mesh.renderOrder = 1;
            this.scene.add(mesh);
            this.activeMeasurement.visuals.fill = mesh;
        }

        this._addAreaLabel();

        this.logger.info(
            `SurfaceAreaMeasurement: Completed - ${this.activeMeasurement.surfaceArea.toFixed(2)}m²`
        );
        this.eventBus.emit('measurement:surfaceArea:completed', { 
            measurement: this.activeMeasurement 
        });

        this.activeMeasurement = null;
    }

    _addPointVisual(point) {
        const geometry = new THREE.SphereGeometry(0.08, 16, 12);
        const sphere = new THREE.Mesh(geometry, this.materials.surfaceAreaPoint);
        sphere.position.copy(point);
        sphere.renderOrder = 999;
        this.scene.add(sphere);
        this.activeMeasurement.visuals.points.push(sphere);
    }

    _addLineVisual(startPoint, endPoint) {
        const geometry = new THREE.BufferGeometry().setFromPoints([startPoint, endPoint]);
        const line = new THREE.Line(geometry, this.materials.surfaceAreaLine);
        line.renderOrder = 998;
        this.scene.add(line);
        this.activeMeasurement.visuals.lines.push(line);
    }

    _updatePreviewLine() {
        if (this.activeMeasurement.visuals.previewLine) {
            this.scene.remove(this.activeMeasurement.visuals.previewLine);
            this.activeMeasurement.visuals.previewLine.geometry.dispose();
        }

        const firstPoint = this.activeMeasurement.points[0];
        const lastPoint = this.activeMeasurement.points[
            this.activeMeasurement.points.length - 1
        ];

        const geometry = new THREE.BufferGeometry().setFromPoints([lastPoint, firstPoint]);
        const line = new THREE.Line(geometry, this.materials.previewLine);
        line.computeLineDistances();
        this.scene.add(line);
        this.activeMeasurement.visuals.previewLine = line;
    }

    _addAreaLabel() {
        const center = new THREE.Vector3();
        this.activeMeasurement.points.forEach(p => center.add(p));
        center.divideScalar(this.activeMeasurement.points.length);

        const text = `${this.activeMeasurement.surfaceArea.toFixed(2)}m²`;
        const label = this._createTextSprite(text, '#00aaff');
        label.position.copy(center).y += 0.2;
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
        sprite.scale.set(1, 0.25, 1);
        sprite.renderOrder = 1000;
        return sprite;
    }

    cancelActiveMeasurement() {
        if (this.activeMeasurement) {
            this.activeMeasurement.visuals.points.forEach(p => {
                this.scene.remove(p);
                p.geometry.dispose();
            });
            this.activeMeasurement.visuals.lines.forEach(l => {
                this.scene.remove(l);
                l.geometry.dispose();
            });
            if (this.activeMeasurement.visuals.fill) {
                this.scene.remove(this.activeMeasurement.visuals.fill);
                this.activeMeasurement.visuals.fill.geometry.dispose();
            }
            if (this.activeMeasurement.visuals.previewLine) {
                this.scene.remove(this.activeMeasurement.visuals.previewLine);
                this.activeMeasurement.visuals.previewLine.geometry.dispose();
            }
            
            const index = this.measurements.indexOf(this.activeMeasurement);
            if (index > -1) {
                this.measurements.splice(index, 1);
            }
            
            this.activeMeasurement = null;
            this.logger.info('SurfaceAreaMeasurement: Active measurement cancelled');
        }
    }

    getFinishedMeasurements() {
        return this.measurements
            .filter(m => m.finished)
            .map(m => ({ id: m.id, value: m.surfaceArea }));
    }

    getMeasurementById(id) {
        return this.measurements.find(m => m.id === id);
    }

    _generateId() {
        return `surface_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}