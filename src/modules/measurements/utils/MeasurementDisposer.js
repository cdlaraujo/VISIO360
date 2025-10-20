// ============================================================================
// FILE: src/modules/measurements/utils/MeasurementDisposer.js
// ============================================================================

/**
 * @class MeasurementDisposer
 * @description Handles proper disposal of measurement visuals and resources.
 * Single Responsibility: Memory management for measurement objects.
 */
export class MeasurementDisposer {
    constructor(scene, sharedMaterials, logger) {
        this.scene = scene;
        this.sharedMaterials = sharedMaterials;
        this.logger = logger;
    }

    /**
     * Dispose all visuals associated with a measurement
     * @param {Object} measurement - The measurement object with visuals
     */
    disposeMeasurement(measurement) {
        if (!measurement || !measurement.visuals) {
            this.logger.warn('MeasurementDisposer: Invalid measurement object');
            return;
        }

        // Dispose points
        if (measurement.visuals.points) {
            measurement.visuals.points.forEach(point => {
                this.scene.remove(point);
                this._disposeObject(point);
            });
        }

        // Dispose lines
        if (measurement.visuals.lines) {
            measurement.visuals.lines.forEach(line => {
                this.scene.remove(line);
                this._disposeObject(line);
            });
        }

        // Dispose fill mesh
        if (measurement.visuals.fill) {
            this.scene.remove(measurement.visuals.fill);
            this._disposeObject(measurement.visuals.fill);
        }

        // Dispose preview line
        if (measurement.visuals.previewLine) {
            this.scene.remove(measurement.visuals.previewLine);
            this._disposeObject(measurement.visuals.previewLine);
        }

        // Dispose labels (sprites with canvas textures)
        if (measurement.visuals.labels) {
            measurement.visuals.labels.forEach(label => {
                this.scene.remove(label);
                this._disposeObject(label);
            });
        }

        this.logger.debug(`MeasurementDisposer: Disposed measurement ${measurement.id}`);
    }

    /**
     * Dispose multiple measurements
     * @param {Array} measurements - Array of measurement objects
     */
    disposeMeasurements(measurements) {
        if (!Array.isArray(measurements)) return;
        
        measurements.forEach(measurement => {
            this.disposeMeasurement(measurement);
        });
        
        this.logger.info(`MeasurementDisposer: Disposed ${measurements.length} measurements`);
    }

    /**
     * Safely dispose a Three.js object with proper material handling
     * @param {THREE.Object3D} obj - The object to dispose
     * @private
     */
    _disposeObject(obj) {
        if (!obj) return;

        // Dispose geometry (always safe - each object has its own)
        if (obj.geometry) {
            obj.geometry.dispose();
        }

        // Dispose material carefully
        if (obj.material) {
            this._disposeMaterial(obj.material);
        }

        // Handle arrays of materials
        if (Array.isArray(obj.material)) {
            obj.material.forEach(mat => this._disposeMaterial(mat));
        }
    }

    /**
     * Dispose a material if it's not shared
     * @param {THREE.Material} material - The material to dispose
     * @private
     */
    _disposeMaterial(material) {
        // Check if this is a shared material
        const isSharedMaterial = Object.values(this.sharedMaterials).includes(material);
        
        if (!isSharedMaterial) {
            // This is a unique material (e.g., sprite materials with canvas textures)
            // Safe to dispose
            
            // Dispose texture/map if it exists (important for canvas-based sprites)
            if (material.map) {
                material.map.dispose();
            }
            
            // Dispose the material itself
            material.dispose();
            
            this.logger.debug('MeasurementDisposer: Disposed unique material');
        } else {
            // This is a shared material - DO NOT DISPOSE
            this.logger.debug('MeasurementDisposer: Skipped shared material');
        }
    }

    /**
     * Dispose shared materials (call only on app shutdown)
     */
    disposeSharedMaterials() {
        if (!this.sharedMaterials) return;

        Object.entries(this.sharedMaterials).forEach(([key, material]) => {
            if (material.map) {
                material.map.dispose();
            }
            material.dispose();
            this.logger.debug(`MeasurementDisposer: Disposed shared material "${key}"`);
        });

        this.logger.info('MeasurementDisposer: All shared materials disposed');
    }
}