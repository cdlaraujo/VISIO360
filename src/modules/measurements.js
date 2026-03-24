// src/modules/measurements.js (Cesium version)

import { MeasurementMaterials } from './measurements/utils/MeasurementMaterials.js';
import { MeasurementDisposer }  from './measurements/utils/MeasurementDisposer.js';
import { MeasurementUI }        from './measurements/MeasurementUI.js';
import { getAll, getById }      from './measurements/MeasurementRegistry.js';

export class Measurements {
    constructor(viewer, logger, eventBus, collaboration) {
        this.viewer        = viewer;
        this.logger        = logger;
        this.eventBus      = eventBus;
        this.collaboration = collaboration;

        this.highlightedEntities      = []; // { entity, originalWidth, originalMaterial }
        this.highlightedMeasurementId = null;

        const colors = new MeasurementMaterials().getMaterials();
        this.disposer = new MeasurementDisposer(viewer, logger);

        this.modules = new Map();
        getAll().forEach(type => {
            this.modules.set(
                type.id,
                type.createModule(viewer, colors, logger, eventBus)
            );
        });

        this.measurementUI = new MeasurementUI(eventBus, this);
        this._setupEventListeners();
        this.logger.info('Measurements Module: Initialized');
    }

    _setupEventListeners() {
        getAll().forEach(type => {
            this.eventBus.on(type.eventName, () => this.measurementUI.update());
        });

        this.eventBus.on('annotation:changed',     () => this.measurementUI.update());
        this.eventBus.on('measurement:highlight',  (p) => this._highlightMeasurement(p.id));
        this.eventBus.on('tool:changed',           () => {
            this.modules.forEach(m => m.cancelActiveMeasurement());
            this._unhighlightCurrent();
        });
        this.eventBus.on('measurement:clear:all',  () => this.clearAllMeasurements());
        this.eventBus.on('measurement:delete',     (p) => {
            if (p.id === this.highlightedMeasurementId) this._unhighlightCurrent();
            this.clearMeasurement(p.id);
        });
    }

    // --- Highlight (Cesium entity color/width change) ---

    _unhighlightCurrent() {
        this.highlightedEntities.forEach(({ entity, originalWidth, originalMaterial }) => {
            if (entity.polyline) {
                entity.polyline.width = originalWidth;
                entity.polyline.material = originalMaterial;
            }
        });
        this.highlightedEntities = [];
        this.highlightedMeasurementId = null;
    }

    _highlightMeasurement(id) {
        if (id === this.highlightedMeasurementId) {
            this._unhighlightCurrent();
            return;
        }
        this._unhighlightCurrent();
        this.highlightedMeasurementId = id;

        let measurement = null;
        for (const module of this.modules.values()) {
            measurement = module.getMeasurementById(id);
            if (measurement) break;
        }

        if (measurement) {
            measurement.visuals.lines.forEach(entity => {
                if (entity.polyline) {
                    this.highlightedEntities.push({
                        entity,
                        originalWidth:    entity.polyline.width?.getValue(),
                        originalMaterial: entity.polyline.material?.getValue()
                    });
                    entity.polyline.width    = 5;
                    entity.polyline.material = new Cesium.ColorMaterialProperty(Cesium.Color.WHITE);
                }
            });
        }
    }

    // --- Public API ---

    getMeasurementStats() {
        const stats = {};
        getAll().forEach(type => stats[type.statsKey] = []);

        const peerData  = this.collaboration?.getPeerProfileData();
        const myPeerId  = this.collaboration?.connectionManager?.myPeerId;
        const myName    = peerData?.myProfile?.name || 'Você';
        const getPeerName = (peerId) => {
            if (!peerId || peerId === myPeerId) return myName;
            return peerData?.peerProfiles?.get(peerId)?.name || 'Peer';
        };

        if (this.collaboration) {
            (this.collaboration.getAnnotations() || []).forEach(ann => {
                const type = getById(ann.type);
                if (!type) return;
                const val = type.getStatValue(ann, getPeerName);
                if (val) stats[type.statsKey].push(val);
            });
        } else {
            getAll().forEach(type => {
                const module = this.modules.get(type.id);
                stats[type.statsKey].push(
                    ...module.getFinishedMeasurements().map(m => ({ ...m, peerName: myName }))
                );
            });
        }
        return stats;
    }

    clearMeasurement(id) {
        if (id === this.highlightedMeasurementId) this._unhighlightCurrent();

        for (const module of this.modules.values()) {
            const measurement = module.getMeasurementById(id);
            if (measurement) {
                this.disposer.disposeMeasurement(measurement);
                const idx = module.measurements.indexOf(measurement);
                if (idx > -1) module.measurements.splice(idx, 1);
                this.collaboration?.annotationSync?.deleteAnnotation(id);
                this.measurementUI.update();
                return;
            }
        }
    }

    clearAllMeasurements() {
        this._unhighlightCurrent();
        const all = [];
        this.modules.forEach(m => all.push(...m.measurements));
        this.disposer.disposeMeasurements(all);
        this.modules.forEach(m => { m.measurements = []; });
        all.forEach(m => this.collaboration?.annotationSync?.deleteAnnotation(m.id));
        this.measurementUI.update();
    }
}
