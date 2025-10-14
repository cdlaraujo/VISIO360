// ============================================================================
// FILE: src/modules/MeasurementManager.js (REFACTORED - PURE COORDINATOR)
// ============================================================================

import * as THREE from 'three';
import { MeasurementMaterials } from './measurements/MeasurementMaterials.js';
import { DistanceMeasurement } from './measurements/DistanceMeasurement.js';
import { AreaMeasurement } from './measurements/AreaMeasurement.js';
import { SurfaceAreaMeasurement } from './measurements/SurfaceAreaMeasurement.js';
import { MeasurementDisposer } from './measurements/MeasurementDisposer.js';

/**
 * @class MeasurementManager
 * @description Pure coordinator for measurement functionality.
 * Delegates all business logic to specialized sub-modules.
 * Single Responsibility: Coordinate measurement modules and handle UI integration.
 */
export class MeasurementManager {
    constructor(scene, logger, eventBus) {
        this.scene = scene;
        this.logger = logger;
        this.eventBus = eventBus;
        this.collaborationManager = null;

        // Current tool state
        this.currentTool = 'none';

        // Create measurement group for scene organization
        this.measurementGroup = new THREE.Group();
        this.measurementGroup.name = 'measurements';
        this.scene.add(this.measurementGroup);

        // Initialize materials
        this.materialManager = new MeasurementMaterials();
        const materials = this.materialManager.getMaterials();

        // Initialize specialized measurement modules
        this.distanceMeasurement = new DistanceMeasurement(
            this.measurementGroup,
            materials,
            logger,
            eventBus
        );

        this.areaMeasurement = new AreaMeasurement(
            this.measurementGroup,
            materials,
            logger,
            eventBus
        );

        this.surfaceAreaMeasurement = new SurfaceAreaMeasurement(
            this.measurementGroup,
            materials,
            logger,
            eventBus
        );

        // Initialize disposer for memory management
        this.disposer = new MeasurementDisposer(
            this.measurementGroup,
            materials,
            logger
        );

        this._setupEventListeners();

        this.logger.info('MeasurementManager: Initialized (refactored coordinator)');
    }

    setCollaborationManager(collaborationManager) {
        this.collaborationManager = collaborationManager;
    }

    _setupEventListeners() {
        // Tool changes
        this.eventBus.on('tool:changed', (payload) => {
            this._onToolChanged(payload.activeTool);
        });

        // Measurement completion events
        this.eventBus.on('measurement:distance:completed', () => {
            this._updateUI();
        });

        this.eventBus.on('measurement:area:completed', () => {
            this._updateUI();
        });

        this.eventBus.on('measurement:surfaceArea:completed', () => {
            this._updateUI();
        });

        // Clear commands
        this.eventBus.on('measurement:clear:all', () => {
            this.clearAllMeasurements();
        });

        this.eventBus.on('measurement:delete', (payload) => {
            this.clearMeasurement(payload.id);
        });
    }

    _onToolChanged(activeTool) {
        // Cancel any active measurements when tool changes
        if (this.currentTool !== activeTool) {
            this._cancelActiveMeasurements();
        }

        this.currentTool = activeTool;
        this._updateInstructions();

        this.logger.info(`MeasurementManager: Tool changed to "${activeTool}"`);
    }

    _cancelActiveMeasurements() {
        // Cancel active measurements in all modules
        this.distanceMeasurement.cancelActiveMeasurement();
        this.areaMeasurement.cancelActiveMeasurement();
        this.surfaceAreaMeasurement.cancelActiveMeasurement();
    }

    _updateInstructions() {
        const instructions = {
            'none': 'Selecione uma ferramenta para começar.',
            'measure': 'Clique em dois pontos para medir a distância.',
            'area': 'Clique para criar um polígono. Dê um duplo-clique ou pressione ESC para calcular a área plana (projeção).',
            'surfaceArea': 'Clique para criar um polígono. Dê um duplo-clique ou pressione ESC para calcular a área real da superfície do modelo dentro do polígono.'
        };

        this.eventBus.emit('ui:instructions:update', {
            text: instructions[this.currentTool] || ''
        });
    }

    _updateUI() {
        const allAnnotations = this.collaborationManager?.getAnnotations() || [];

        const stats = {
            distances: [],
            areas: [],
            surfaceAreas: []
        };
        
        // Add remote/synced annotations
        allAnnotations.forEach(ann => {
            if (ann.type === 'distance') {
                stats.distances.push({ id: ann.id, value: ann.distance });
            } else if (ann.type === 'area') {
                stats.areas.push({ id: ann.id, value: ann.area });
            } else if (ann.type === 'surfaceArea') {
                stats.surfaceAreas.push({ id: ann.id, value: ann.surfaceArea });
            }
        });
        
        // If not in a session, add local measurements
        if (!this.collaborationManager || !this.collaborationManager.isConnected()) {
            stats.distances.push(...this.distanceMeasurement.getFinishedMeasurements());
            stats.areas.push(...this.areaMeasurement.getFinishedMeasurements());
            stats.surfaceAreas.push(...this.surfaceAreaMeasurement.getFinishedMeasurements());
        }

        this.eventBus.emit('ui:measurements:update', stats);
    }


    clearAllMeasurements() {
        this.logger.info('MeasurementManager: Clearing all measurements');

        // Get all measurements from all modules
        const allMeasurements = [
            ...this.distanceMeasurement.measurements,
            ...this.areaMeasurement.measurements,
            ...this.surfaceAreaMeasurement.measurements
        ];

        // Dispose them all
        this.disposer.disposeMeasurements(allMeasurements);

        // Clear arrays in each module
        this.distanceMeasurement.measurements = [];
        this.areaMeasurement.measurements = [];
        this.surfaceAreaMeasurement.measurements = [];

        this._updateUI();
        this.logger.info('MeasurementManager: All measurements cleared');
    }

    clearMeasurement(id) {
        // Try to find and delete from each module
        const modules = [
            this.distanceMeasurement,
            this.areaMeasurement,
            this.surfaceAreaMeasurement
        ];

        for (const module of modules) {
            const measurement = module.getMeasurementById(id);
            if (measurement) {
                // Dispose visuals
                this.disposer.disposeMeasurement(measurement);

                // Remove from module's array
                const index = module.measurements.indexOf(measurement);
                if (index > -1) {
                    module.measurements.splice(index, 1);
                }

                this.logger.info(`MeasurementManager: Measurement ${id} removed`);
                this._updateUI();
                return;
            }
        }

        this.logger.warn(`MeasurementManager: Measurement ${id} not found`);
    }

    getAllMeasurements() {
        return {
            distance: this.distanceMeasurement.measurements,
            area: this.areaMeasurement.measurements,
            surfaceArea: this.surfaceAreaMeasurement.measurements
        };
    }

    getStatistics() {
        const allMeasurements = this.getAllMeasurements();

        return {
            totalCount:
                allMeasurements.distance.length +
                allMeasurements.area.length +
                allMeasurements.surfaceArea.length,
            distanceCount: allMeasurements.distance.length,
            areaCount: allMeasurements.area.length,
            surfaceAreaCount: allMeasurements.surfaceArea.length,
            finishedCount:
                allMeasurements.distance.filter(m => m.finished).length +
                allMeasurements.area.filter(m => m.finished).length +
                allMeasurements.surfaceArea.filter(m => m.finished).length
        };
    }

    destroy() {
        this.logger.info('MeasurementManager: Destroying and cleaning up...');

        // Clear all measurements first
        this.clearAllMeasurements();

        // Dispose shared materials
        this.disposer.disposeSharedMaterials();

        // Remove measurement group from scene
        if (this.scene && this.measurementGroup) {
            this.scene.remove(this.measurementGroup);
        }

        // Clear references
        this.materialManager = null;
        this.distanceMeasurement = null;
        this.areaMeasurement = null;
        this.surfaceAreaMeasurement = null;
        this.disposer = null;
        this.measurementGroup = null;

        this.logger.info('MeasurementManager: Destruction complete');
    }
}