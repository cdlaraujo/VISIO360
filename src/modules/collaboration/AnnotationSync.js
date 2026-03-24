// src/modules/collaboration/AnnotationSync.js
// Cesium version: uses viewer.entities instead of THREE.Group

import { getAll, getById } from '../measurements/MeasurementRegistry.js';

export class AnnotationSync {
    constructor(viewer, connectionManager, logger, eventBus) {
        this.viewer            = viewer;
        this.connectionManager = connectionManager;
        this.logger            = logger;
        this.eventBus          = eventBus;

        // id → array of Cesium entity references
        this.annotationEntities  = new Map();
        this.annotationDataRegistry = new Map();

        this._setupEventListeners();
    }

    _setupEventListeners() {
        getAll().forEach(type => {
            this.eventBus.on(type.eventName, (payload) => {
                this._broadcastMeasurement(type.id, payload.measurement);
            });
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

    _broadcastMeasurement(typeId, measurement) {
        const type = getById(typeId);
        if (!type) return;

        const annotation = {
            id:        measurement.id,
            type:      typeId,
            timestamp: Date.now(),
            peerId:    this.connectionManager.myPeerId,
            ...type.serialize(measurement)
        };

        this.annotationDataRegistry.set(annotation.id, annotation);
        this.eventBus.emit('annotation:changed');
        this.logger.debug(`AnnotationSync: Broadcasting ${typeId} measurement`);
        this.connectionManager.broadcast({ type: 'annotation-create', annotation });
    }

    _handleRemoteAnnotation(annotation) {
        this.logger.info(`AnnotationSync: Received ${annotation.type} from peer`);

        // Remove stale
        if (this.annotationEntities.has(annotation.id)) {
            this._removeEntities(annotation.id);
        }

        const descriptor = getById(annotation.type);
        if (!descriptor) return;

        const entityDefs = descriptor.createVisual(annotation);
        if (!entityDefs?.length) return;

        // Add each entity definition to the viewer
        const entities = entityDefs.map(def => this.viewer.entities.add(def));
        this.annotationEntities.set(annotation.id, entities);
        this.annotationDataRegistry.set(annotation.id, annotation);

        this.eventBus.emit('annotation:remote-added', { annotation });
        this.eventBus.emit('annotation:changed');
    }

    _handleRemoteAnnotationDelete(annotationId) {
        this._removeEntities(annotationId);
        if (this.annotationDataRegistry.has(annotationId)) {
            this.annotationDataRegistry.delete(annotationId);
            this.eventBus.emit('annotation:changed');
        }
    }

    _removeAnnotationsFromPeer(peerId) {
        const toRemove = [];
        this.annotationDataRegistry.forEach((ann, id) => {
            if (ann.peerId === peerId) toRemove.push(id);
        });
        toRemove.forEach(id => this._handleRemoteAnnotationDelete(id));
        if (toRemove.length > 0) {
            this.logger.info(`AnnotationSync: Removed ${toRemove.length} annotations from peer ${peerId}`);
        }
    }

    _removeEntities(annotationId) {
        const entities = this.annotationEntities.get(annotationId);
        if (entities) {
            entities.forEach(e => this.viewer.entities.remove(e));
            this.annotationEntities.delete(annotationId);
        }
    }

    deleteAnnotation(annotationId) {
        this.connectionManager.broadcast({ type: 'annotation-delete', annotationId });
        this._handleRemoteAnnotationDelete(annotationId);
    }

    clearAllAnnotations() {
        this.annotationEntities.forEach((_, id) => this._removeEntities(id));
        this.annotationDataRegistry.clear();
        this.logger.info('AnnotationSync: All remote annotations cleared');
        this.eventBus.emit('annotation:changed');
    }

    getAnnotations()   { return Array.from(this.annotationDataRegistry.values()); }
    getAnnotationIds() { return Array.from(this.annotationEntities.keys()); }
}
