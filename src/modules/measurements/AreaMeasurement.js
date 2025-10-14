// ============================================================================
// FILE: src/modules/measurements/AreaMeasurement.js
// ============================================================================

import * as THREE from 'three';

/**
 * @class AreaMeasurement
 * @description Handles planar area measurement (projection-based).
 * Single Responsibility: Manage planar area measurements only.
 */
export class AreaMeasurement {
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
            if (payload.tool === 'area') {
                this._handlePointSelected(payload.point);
            }
        });

        this.eventBus.on('measurement:area:finish', () => {
            this._finishMeasurement();
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

        if (this.activeMeasurement.points.length >= 3) {
            this._updateFillMesh();
        }

        this.logger.debug(`AreaMeasurement: Point ${this.activeMeasurement.points.length} added`);
    }

    _startMeasurement() {
        this.activeMeasurement = {
            id: this._generateId(),
            type: 'area',
            points: [],
            visuals: { points: [], lines: [], fill: null, previewLine: null, labels: [] },
            finished: false
        };

        this.measurements.push(this.activeMeasurement);
        this.logger.info('AreaMeasurement: Started new area measurement');
    }

    _finishMeasurement() {
        if (!this.activeMeasurement || this.activeMeasurement.points.length < 3) {
            this.logger.warn('AreaMeasurement: Cannot finish - need at least 3 points');
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

        this.activeMeasurement.area = this._calculate3DPolygonArea(
            this.activeMeasurement.points
        );
        this.activeMeasurement.finished = true;

        this._updateFillMesh();
        this._addAreaLabel();

        this.logger.info(`AreaMeasurement: Completed - ${this.activeMeasurement.area.toFixed(2)}m²`);
        this.eventBus.emit('measurement:area:completed', { 
            measurement: this.activeMeasurement 
        });

        this.activeMeasurement = null;
    }

    _addPointVisual(point) {
        const geometry = new THREE.SphereGeometry(0.08, 16, 12);
        const sphere = new THREE.Mesh(geometry, this.materials.areaPoint);
        sphere.position.copy(point);
        sphere.renderOrder = 999;
        this.scene.add(sphere);
        this.activeMeasurement.visuals.points.push(sphere);
    }

    _addLineVisual(startPoint, endPoint) {
        const geometry = new THREE.BufferGeometry().setFromPoints([startPoint, endPoint]);
        const line = new THREE.Line(geometry, this.materials.areaLine);
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

    _updateFillMesh() {
        if (this.activeMeasurement.visuals.fill) {
            this.scene.remove(this.activeMeasurement.visuals.fill);
            this.activeMeasurement.visuals.fill.geometry.dispose();
        }

        if (this.activeMeasurement.points.length < 3) return;

        const geometry = this._createPolygonGeometry(this.activeMeasurement.points);
        const mesh = new THREE.Mesh(geometry, this.materials.areaFill);
        mesh.renderOrder = 997;
        this.scene.add(mesh);
        this.activeMeasurement.visuals.fill = mesh;
    }

    _createPolygonGeometry(points) {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        points.forEach(p => vertices.push(p.x, p.y, p.z));
        
        const indices = [];
        for (let i = 1; i < points.length - 1; i++) {
            indices.push(0, i, i + 1);
        }
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        return geometry;
    }

    _calculate3DPolygonArea(points) {
        if (points.length < 3) return 0;
        
        let area = 0;
        const n = points.length;
        const normal = new THREE.Vector3().crossVectors(
            new THREE.Vector3().subVectors(points[1], points[0]), 
            new THREE.Vector3().subVectors(points[2], points[0])
        ).normalize();
        
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            area += normal.dot(new THREE.Vector3().crossVectors(points[i], points[j]));
        }
        
        return Math.abs(area) / 2;
    }

    _addAreaLabel() {
        const center = new THREE.Vector3();
        this.activeMeasurement.points.forEach(p => center.add(p));
        center.divideScalar(this.activeMeasurement.points.length);

        const text = `${this.activeMeasurement.area.toFixed(2)}m²`;
        const label = this._createTextSprite(text, '#00ff00');
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
            this.logger.info('AreaMeasurement: Active measurement cancelled');
        }
    }

    getFinishedMeasurements() {
        return this.measurements
            .filter(m => m.finished)
            .map(m => ({ id: m.id, value: m.area }));
    }

    getMeasurementById(id) {
        return this.measurements.find(m => m.id === id);
    }

    _generateId() {
        return `area_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}