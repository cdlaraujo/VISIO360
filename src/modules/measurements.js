// src/modules/measurements.js (New Coordinator File)

import * as THREE from 'three';
import { MeasurementMaterials } from './measurements/utils/MeasurementMaterials.js';
import { DistanceMeasurement } from './measurements/DistanceMeasurement.js';
import { AreaMeasurement } from './measurements/AreaMeasurement.js';
import { SurfaceAreaMeasurement } from './measurements/SurfaceAreaMeasurement.js';
import { MeasurementDisposer } from './measurements/utils/MeasurementDisposer.js';
import { MeasurementUI } from './measurements/MeasurementUI.js';

/**
 * @class Measurements
 * @description
 * Pure orchestrator for all measurement-related functionalities.
 * This module follows the Coordinator pattern. It instantiates and wires up all the
 * specialized "worker" modules.
 */
export class Measurements {
    constructor(scene, logger, eventBus, collaboration) {
        this.logger = logger;
        this.eventBus = eventBus;
        this.scene = scene;
        this.collaboration = collaboration; // For accessing annotation data

        // A group to hold all measurement visuals in the scene
        this.measurementGroup = new THREE.Group();
        this.measurementGroup.name = 'measurements';
        this.scene.add(this.measurementGroup);

        // --- 1. Instantiate All Worker Modules ---
        this.materials = new MeasurementMaterials();
        const sharedMaterials = this.materials.getMaterials();

        this.disposer = new MeasurementDisposer(this.measurementGroup, sharedMaterials, logger);

        this.distanceMeasurement = new DistanceMeasurement(this.measurementGroup, sharedMaterials, logger, eventBus);
        this.areaMeasurement = new AreaMeasurement(this.measurementGroup, sharedMaterials, logger, eventBus);
        this.surfaceAreaMeasurement = new SurfaceAreaMeasurement(this.measurementGroup, sharedMaterials, logger, eventBus);

        // This new worker handles all UI-related logic for measurements
        this.measurementUI = new MeasurementUI(eventBus, this);

        // --- 2. Wire Up Inter-Module Communication ---
        this._setupEventListeners();

        this.logger.info('Measurements Module: Initialized (Coordinator Pattern)');
    }

    /**
     * Sets up the event-based communication.
     * @private
     */
    _setupEventListeners() {
        // When any measurement is completed, or annotations change, update the UI.
        this.eventBus.on('measurement:distance:completed', () => this.measurementUI.update());
        this.eventBus.on('measurement:area:completed', () => this.measurementUI.update());
        this.eventBus.on('measurement:surfaceArea:completed', () => this.measurementUI.update());
        this.eventBus.on('annotation:changed', () => this.measurementUI.update());

        // When a tool changes, cancel any in-progress measurements.
        this.eventBus.on('tool:changed', () => {
            this.distanceMeasurement.cancelActiveMeasurement();
            this.areaMeasurement.cancelActiveMeasurement();
            this.surfaceAreaMeasurement.cancelActiveMeasurement();
        });

        // Handle commands to clear or delete measurements.
        this.eventBus.on('measurement:clear:all', () => this.clearAllMeasurements());
        this.eventBus.on('measurement:delete', (payload) => this.clearMeasurement(payload.id));
    }

    // --- PUBLIC API ---

    /**
     * Gathers all finished measurements from local modules and synced annotations.
     * @returns {{distances: Array, areas: Array, surfaceAreas: Array}}
     */
    getMeasurementStats() {
        const stats = {
            distances: [],
            areas: [],
            surfaceAreas: []
        };

        // If not in a collaborative session, get data from local modules.
        if (!this.collaboration || !this.collaboration.isConnected()) {
            stats.distances.push(...this.distanceMeasurement.getFinishedMeasurements());
            stats.areas.push(...this.areaMeasurement.getFinishedMeasurements());
            stats.surfaceAreas.push(...this.surfaceAreaMeasurement.getFinishedMeasurements());
        }

        // Always include synced annotations from the collaboration module.
        const allAnnotations = this.collaboration?.getAnnotations() || [];
        allAnnotations.forEach(ann => {
            if (ann.type === 'distance') {
                stats.distances.push({ id: ann.id, value: ann.distance });
            } else if (ann.type === 'area') {
                stats.areas.push({ id: ann.id, value: ann.area });
            } else if (ann.type === 'surfaceArea') {
                stats.surfaceAreas.push({ id: ann.id, value: ann.surfaceArea });
            }
        });

        return stats;
    }

    /**
     * Clears a single measurement by its ID.
     * @param {string} id - The ID of the measurement to remove.
     */
    clearMeasurement(id) {
        const modules = [this.distanceMeasurement, this.areaMeasurement, this.surfaceAreaMeasurement];
        for (const module of modules) {
            const measurement = module.getMeasurementById(id);
            if (measurement) {
                this.disposer.disposeMeasurement(measurement);
                const index = module.measurements.indexOf(measurement);
                if (index > -1) {
                    module.measurements.splice(index, 1);
                }
                this.logger.info(`Measurements Coordinator: Cleared measurement ${id}`);
                this.measurementUI.update(); // Refresh UI after deletion
                return;
            }
        }
    }

    /**
     * Clears all local measurements and their visuals.
     */
    clearAllMeasurements() {
        this.logger.info('Measurements Coordinator: Clearing all local measurements.');
        const allMeasurements = [
            ...this.distanceMeasurement.measurements,
            ...this.areaMeasurement.measurements,
            ...this.surfaceAreaMeasurement.measurements
        ];

        this.disposer.disposeMeasurements(allMeasurements);

        this.distanceMeasurement.measurements = [];
        this.areaMeasurement.measurements = [];
        this.surfaceAreaMeasurement.measurements = [];

        this.measurementUI.update();
    }
}