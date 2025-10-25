// src/modules/measurements.js (FIXED for Duplication)

import * as THREE from 'three';
import { MeasurementMaterials } from './measurements/utils/MeasurementMaterials.js';
import { DistanceMeasurement } from './measurements/DistanceMeasurement.js';
import { AreaMeasurement } from './measurements/AreaMeasurement.js';
import { SurfaceAreaMeasurement } from './measurements/SurfaceAreaMeasurement.js';
import { AngleMeasurement } from './measurements/AngleMeasurement.js';
import { VolumeMeasurement } from './measurements/VolumeMeasurement.js'; // <-- 1. IMPORTAR
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
        this.angleMeasurement = new AngleMeasurement(this.measurementGroup, sharedMaterials, logger, eventBus);
        this.volumeMeasurement = new VolumeMeasurement(this.measurementGroup, sharedMaterials, logger, eventBus); // <-- 2. INSTANCIAR

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
        this.eventBus.on('measurement:angle:completed', () => this.measurementUI.update());
        this.eventBus.on('measurement:volume:completed', () => this.measurementUI.update()); // <-- 3. ADICIONAR LISTENER
        this.eventBus.on('annotation:changed', () => this.measurementUI.update());

        // When a tool changes, cancel any in-progress measurements.
        this.eventBus.on('tool:changed', () => {
            this.distanceMeasurement.cancelActiveMeasurement();
            this.areaMeasurement.cancelActiveMeasurement();
            this.surfaceAreaMeasurement.cancelActiveMeasurement();
            this.angleMeasurement.cancelActiveMeasurement();
            this.volumeMeasurement.cancelActiveMeasurement(); // <-- 4. ADICIONAR LIMPEZA
        });

        // Handle commands to clear or delete measurements.
        this.eventBus.on('measurement:clear:all', () => this.clearAllMeasurements());
        this.eventBus.on('measurement:delete', (payload) => this.clearMeasurement(payload.id));
    }

    // --- PUBLIC API ---

    /**
     * Gathers all finished measurements from local modules and synced annotations.
     * @returns {{distances: Array, areas: Array, surfaceAreas: Array, angles: Array, volumes: Array}}
     */
    getMeasurementStats() {
        const stats = {
            distances: [],
            areas: [],
            surfaceAreas: [],
            angles: [],
            volumes: [] // <-- 5. ADICIONAR AO STATS
        };

        const isConnected = this.collaboration?.isConnected() || false;

        // FIX: Ensure mutual exclusivity of data sources based on connection status.
        if (!isConnected) {
            // If NOT connected, the local measurement modules are the single source of truth.
            stats.distances.push(...this.distanceMeasurement.getFinishedMeasurements());
            stats.areas.push(...this.areaMeasurement.getFinishedMeasurements());
            stats.surfaceAreas.push(...this.surfaceAreaMeasurement.getFinishedMeasurements());
            stats.angles.push(...this.angleMeasurement.getFinishedMeasurements());
            stats.volumes.push(...this.volumeMeasurement.getFinishedMeasurements()); // <-- 6. ADICIONAR AO STATS
        } else {
            // If CONNECTED, the collaboration module's annotations are the unified source of truth.
            const allAnnotations = this.collaboration?.getAnnotations() || [];
            allAnnotations.forEach(ann => {
                if (ann.type === 'distance') {
                    stats.distances.push({ id: ann.id, value: ann.distance });
                } else if (ann.type === 'area') {
                    stats.areas.push({ id: ann.id, value: ann.area });
                } else if (ann.type === 'surfaceArea') {
                    stats.surfaceAreas.push({ id: ann.id, value: ann.surfaceArea });
                } else if (ann.type === 'volume') { // <-- 7. ADICIONAR AO STATS DE COLABORAÇÃO
                    stats.volumes.push({ id: ann.id, value: ann.volume });
                }
            });
        }

        return stats;
    }

    /**
     * Clears a single measurement by its ID.
     * @param {string} id - The ID of the measurement to remove.
     */
    clearMeasurement(id) {
        const modules = [this.distanceMeasurement, this.areaMeasurement, this.surfaceAreaMeasurement, this.angleMeasurement, this.volumeMeasurement]; // <-- 8. ADICIONAR AO LOOP
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
            ...this.surfaceAreaMeasurement.measurements,
            ...this.angleMeasurement.measurements,
            ...this.volumeMeasurement.measurements // <-- 9. ADICIONAR À LIMPEZA
        ];

        this.disposer.disposeMeasurements(allMeasurements);

        this.distanceMeasurement.measurements = [];
        this.areaMeasurement.measurements = [];
        this.surfaceAreaMeasurement.measurements = [];
        this.angleMeasurement.measurements = [];
        this.volumeMeasurement.measurements = []; // <-- 10. LIMPAR ARRAY

        this.measurementUI.update();
    }
}