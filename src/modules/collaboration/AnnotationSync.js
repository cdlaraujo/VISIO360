// ============================================================================
// FILE 6: src/modules/collaboration/AnnotationSync.js
// ============================================================================

import * as THREE from 'three';

/**
 * @class AnnotationSync
 * @description Handles synchronization of annotations (measurements) between peers.
 * Single Responsibility: Sync measurement data across connected peers.
 */
export class AnnotationSync {
    constructor(scene, connectionManager, logger, eventBus) {
        this.scene = scene;
        this.connectionManager = connectionManager;
        this.logger = logger;
        this.eventBus = eventBus;

        this.remoteAnnotationGroup = new THREE.Group();
        this.remoteAnnotationGroup.name = 'remote-annotations';
        this.scene.add(this.remoteAnnotationGroup);

        this.annotationRegistry = new Map();
        this.annotationDataRegistry = new Map(); // Stores the raw annotation data

        this._setupEventListeners();
    }

    _setupEventListeners() {
        this.eventBus.on('measurement:distance:completed', (payload) => {
            this._broadcastMeasurement('distance', payload.measurement);
        });

        this.eventBus.on('measurement:area:completed', (payload) => {
            this._broadcastMeasurement('area', payload.measurement);
        });

        this.eventBus.on('measurement:surfaceArea:completed', (payload) => {
            this._broadcastMeasurement('surfaceArea', payload.measurement);
        });

        this.eventBus.on('connection:data', (payload) => {
            if (payload.data.type === 'annotation-create') {
                this._handleRemoteAnnotation(payload.data.annotation);
            } else if (payload.data.type === 'annotation-delete') {
                this._handleRemoteAnnotationDelete(payload.data.annotationId);
            }
        });

        this.eventBus.on('connection:peer-disconnected', (payload) => {
            this._removeAnnotationsFromPeer(payload.peerId);
        });
    }

    _broadcastMeasurement(type, measurement) {
        const annotation = {
            id: measurement.id, // Use the ID from the measurement module
            type: type,
            timestamp: Date.now(),
            peerId: this.connectionManager.myPeerId // Track who created it
        };

        if (type === 'distance') {
            annotation.distance = measurement.distance;
            annotation.points = measurement.points.map(p => ({ x: p.x, y: p.y, z: p.z }));
        } else if (type === 'area') {
            annotation.area = measurement.area;
            annotation.points = measurement.points.map(p => ({ x: p.x, y: p.y, z: p.z }));
        } else if (type === 'surfaceArea') {
            annotation.surfaceArea = measurement.surfaceArea;
            annotation.points = measurement.points.map(p => ({ x: p.x, y: p.y, z: p.z }));
        }

        // Store it locally immediately
        this.annotationDataRegistry.set(annotation.id, annotation);
        this.eventBus.emit('annotation:changed');

        this.logger.debug(`AnnotationSync: Broadcasting ${type} measurement`);

        this.connectionManager.broadcast({
            type: 'annotation-create',
            annotation: annotation
        });
    }

    _handleRemoteAnnotation(annotation) {
        this.logger.info(`AnnotationSync: Received ${annotation.type} annotation from peer`);

        // If we already have this annotation, remove the old visual first
        if (this.annotationRegistry.has(annotation.id)) {
            const oldVisual = this.annotationRegistry.get(annotation.id);
            this.remoteAnnotationGroup.remove(oldVisual);
            this._disposeVisual(oldVisual);
            this.annotationRegistry.delete(annotation.id);
        }

        let visual = null;

        if (annotation.type === 'distance') {
            visual = this._createDistanceVisual(annotation);
        } else if (annotation.type === 'area') {
            visual = this._createAreaVisual(annotation);
        } else if (annotation.type === 'surfaceArea') {
            visual = this._createSurfaceAreaVisual(annotation);
        }

        if (visual) {
            visual.userData.annotationId = annotation.id;
            this.remoteAnnotationGroup.add(visual);
            this.annotationRegistry.set(annotation.id, visual);
            this.annotationDataRegistry.set(annotation.id, annotation); // Store data

            this.eventBus.emit('annotation:remote-added', { annotation });
            this.eventBus.emit('annotation:changed'); // Notify UI to update
        }
    }

    _handleRemoteAnnotationDelete(annotationId) {
        const visual = this.annotationRegistry.get(annotationId);
        if (visual) {
            this.remoteAnnotationGroup.remove(visual);
            this._disposeVisual(visual);
            this.annotationRegistry.delete(annotationId);
            this.annotationDataRegistry.delete(annotationId); // Delete data
            this.logger.debug(`AnnotationSync: Removed remote annotation ${annotationId}`);
            this.eventBus.emit('annotation:changed'); // Notify UI to update
        }
    }

    _removeAnnotationsFromPeer(peerId) {
        const toRemove = [];

        this.annotationDataRegistry.forEach((annotation, annotationId) => {
            if (annotation.peerId === peerId) {
                toRemove.push(annotationId);
            }
        });

        toRemove.forEach(annotationId => {
            this._handleRemoteAnnotationDelete(annotationId);
        });

        if (toRemove.length > 0) {
            this.logger.info(`AnnotationSync: Removed ${toRemove.length} annotations from disconnected peer ${peerId}`);
        }
    }

    _createDistanceVisual(annotation) {
        const group = new THREE.Group();
        const points = annotation.points.map(p => new THREE.Vector3(p.x, p.y, p.z));

        const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x00ffff,
            linewidth: 2,
            depthTest: false
        });
        const line = new THREE.Line(lineGeometry, lineMaterial);
        line.renderOrder = 998;

        const midPoint = new THREE.Vector3()
            .addVectors(points[0], points[1])
            .multiplyScalar(0.5);
        const label = this._createTextSprite(`${annotation.distance.toFixed(2)}m`, '#00ffff');
        
        // ✅ FIX: Apply consistent offset logic for remote visuals
        label.position.copy(midPoint).add(new THREE.Vector3(0, 0.2, 0));

        group.add(line, label);
        return group;
    }

    _createAreaVisual(annotation) {
        const group = new THREE.Group();
        const points = annotation.points.map(p => new THREE.Vector3(p.x, p.y, p.z));

        const lineGeometry = new THREE.BufferGeometry().setFromPoints([...points, points[0]]);
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x00ff00,
            linewidth: 2,
            depthTest: false
        });
        const line = new THREE.Line(lineGeometry, lineMaterial);
        line.renderOrder = 998;

        const center = new THREE.Vector3();
        points.forEach(p => center.add(p));
        center.divideScalar(points.length);

        // ✅ FIX: Apply consistent offset logic for remote visuals
        const normal = new THREE.Vector3().crossVectors(
            new THREE.Vector3().subVectors(points[1], points[0]),
            new THREE.Vector3().subVectors(points[2], points[0])
        ).normalize();

        const label = this._createTextSprite(`${annotation.area.toFixed(2)}m²`, '#00ff00');
        label.position.copy(center).add(normal.multiplyScalar(0.2));

        group.add(line, label);
        return group;
    }

    _createSurfaceAreaVisual(annotation) {
        const group = new THREE.Group();
        const points = annotation.points.map(p => new THREE.Vector3(p.x, p.y, p.z));

        const lineGeometry = new THREE.BufferGeometry().setFromPoints([...points, points[0]]);
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x00aaff,
            linewidth: 2,
            depthTest: false
        });
        const line = new THREE.Line(lineGeometry, lineMaterial);
        line.renderOrder = 998;

        const center = new THREE.Vector3();
        points.forEach(p => center.add(p));
        center.divideScalar(points.length);

        // ✅ FIX: Apply consistent offset logic for remote visuals
        const normal = new THREE.Vector3().crossVectors(
            new THREE.Vector3().subVectors(points[1], points[0]),
            new THREE.Vector3().subVectors(points[2], points[0])
        ).normalize();
        
        const label = this._createTextSprite(`${annotation.surfaceArea.toFixed(2)}m²`, '#00aaff');
        label.position.copy(center).add(normal.multiplyScalar(0.2));

        group.add(line, label);
        return group;
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
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: texture,
            depthTest: false
        }));
        sprite.scale.set(1.2, 0.3, 1.0);
        sprite.renderOrder = 1000;

        return sprite;
    }

    _disposeVisual(visual) {
        visual.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (obj.material.map) obj.material.map.dispose();
                obj.material.dispose();
            }
        });
    }

    deleteAnnotation(annotationId) {
        this.connectionManager.broadcast({
            type: 'annotation-delete',
            annotationId: annotationId
        });

        this._handleRemoteAnnotationDelete(annotationId);
    }

    clearAllAnnotations() {
        this.annotationRegistry.forEach((visual, annotationId) => {
            this.remoteAnnotationGroup.remove(visual);
            this._disposeVisual(visual);
        });
        this.annotationRegistry.clear();
        this.annotationDataRegistry.clear();
        this.logger.info('AnnotationSync: All remote annotations cleared');
        this.eventBus.emit('annotation:changed');
    }

    getAnnotations() {
        return Array.from(this.annotationDataRegistry.values());
    }

    getAnnotationIds() {
        return Array.from(this.annotationRegistry.keys());
    }
}